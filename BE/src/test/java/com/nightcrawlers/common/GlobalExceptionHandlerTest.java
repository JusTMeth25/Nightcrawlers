package com.nightcrawlers.common;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.sql.SQLException;

import org.hibernate.exception.ConstraintViolationException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;

@ExtendWith(OutputCaptureExtension.class)
@WebMvcTest(controllers = GlobalExceptionHandlerTest.ProbeController.class)
@AutoConfigureMockMvc(addFilters = false)
@Import({ GlobalExceptionHandler.class, GlobalExceptionHandlerTest.ProbeController.class })
class GlobalExceptionHandlerTest {

    @Autowired
    MockMvc mvc;

    @Test
    void validationErrorsAreProblemJsonWithFieldErrors() throws Exception {
        mvc.perform(post("/probe/validate").contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.type").exists())
                .andExpect(jsonPath("$.title").exists())
                .andExpect(jsonPath("$.errors.name").isString());
    }

    @Test
    void malformedJsonIsProblemJson400() throws Exception {
        mvc.perform(post("/probe/validate").contentType(MediaType.APPLICATION_JSON).content("{nope"))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.title").value("Richiesta non valida"))
                .andExpect(jsonPath("$.detail").value("La richiesta non è leggibile o non è valida."));
    }

    @Test
    void springDefaultErrorsGetItalianTitles() throws Exception {
        mvc.perform(get("/probe/validate"))
                .andExpect(status().isMethodNotAllowed())
                .andExpect(jsonPath("$.title").value("Metodo non consentito"));
    }

    @Test
    void apiExceptionKeepsStatusTitleAndDetail() throws Exception {
        mvc.perform(get("/probe/conflict"))
                .andExpect(status().isConflict())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.status").value(409))
                .andExpect(jsonPath("$.title").value("Conflitto di prova"))
                .andExpect(jsonPath("$.detail").value("dettaglio"));
    }

    @Test
    void unexpectedExceptionIsGeneric500WithoutStackTrace() throws Exception {
        mvc.perform(get("/probe/boom"))
                .andExpect(status().isInternalServerError())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.title").value("Errore interno"))
                .andExpect(jsonPath("$.status").value(500))
                .andExpect(content().string(not(containsString("segreto"))))
                .andExpect(content().string(not(containsString("IllegalStateException"))))
                .andExpect(content().string(not(containsString("at com."))));
    }

    @Test
    void unexpectedExceptionIsLoggedWithoutItsMessageButWithAnErrorId(CapturedOutput output) throws Exception {
        String body = mvc.perform(get("/probe/personal"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.errorId").isString())
                .andReturn().getResponse().getContentAsString();
        String errorId = com.jayway.jsonpath.JsonPath.read(body, "$.errorId");

        assertThat(output).contains(errorId).contains("IllegalArgumentException").contains("ProbeController")
                .doesNotContain("mario.rossi@mail.it");
    }

    @Test
    void optimisticLockFailureIsAConflict() throws Exception {
        mvc.perform(get("/probe/stale"))
                .andExpect(status().isConflict())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.title").value("Conflitto"));
    }

    @Test
    void integrityViolationIsLoggedWithoutPersonalData(CapturedOutput output) throws Exception {
        mvc.perform(get("/probe/duplicate"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.title").value("Conflitto"));
        assertThat(output).contains("ux_users_email").doesNotContain("mario.rossi@mail.it");
    }

    record NameRequest(@NotBlank String name) {
    }

    @RestController
    static class ProbeController {

        @PostMapping("/probe/validate")
        String validate(@Valid @RequestBody NameRequest request) {
            return request.name();
        }

        @GetMapping("/probe/conflict")
        String conflict() {
            throw new ApiException(HttpStatus.CONFLICT, "Conflitto di prova", "dettaglio");
        }

        @GetMapping("/probe/duplicate")
        String duplicate() {
            String detail = "ERROR: duplicate key value violates unique constraint \"ux_users_email\" "
                    + "Detail: Key (email)=(mario.rossi@mail.it) already exists.";
            throw new DataIntegrityViolationException(detail,
                    new ConstraintViolationException(detail, new SQLException(detail, "23505"), "ux_users_email"));
        }

        @GetMapping("/probe/personal")
        String personal() {
            throw new IllegalStateException("wrapper",
                    new IllegalArgumentException("Utente mario.rossi@mail.it non valido"));
        }

        @GetMapping("/probe/stale")
        String stale() {
            throw new org.springframework.orm.ObjectOptimisticLockingFailureException("PlayerSave", "id");
        }

        @GetMapping("/probe/boom")
        String boom() {
            throw new IllegalStateException("segreto interno");
        }
    }
}
