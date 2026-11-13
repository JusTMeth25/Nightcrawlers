package com.nightcrawlers.common;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.net.http.HttpResponse;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import com.nightcrawlers.support.CapturingMailService;
import com.nightcrawlers.support.IntegrationTest;
import com.nightcrawlers.support.MutableClock;
import com.nightcrawlers.support.RawHttp;
import com.nightcrawlers.support.TestApi;
import com.nightcrawlers.support.TestApi.Account;
import com.nightcrawlers.support.TestApi.Session;

/** Problem titles, details and field errors follow Accept-Language (it, en, es), Italian otherwise. */
@IntegrationTest
class LocalizedErrorsIT {

    @Autowired
    MockMvc mvc;
    @Autowired
    CapturingMailService mail;
    @Autowired
    MutableClock clock;
    @LocalServerPort
    int port;

    TestApi api;

    @BeforeEach
    void setUp() {
        clock.reset();
        api = new TestApi(mvc, mail);
    }

    private ResultActions wrongLogin(String acceptLanguage) throws Exception {
        var request = post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"login\":\"nobody_" + TestApi.uniqueName() + "\",\"password\":\"Wrong-password-1\"}");
        if (acceptLanguage != null) {
            request.header("Accept-Language", acceptLanguage);
        }
        return mvc.perform(request).andExpect(status().isUnauthorized())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.type").value("about:blank"))
                .andExpect(jsonPath("$.status").value(401));
    }

    @Test
    void businessErrorsFollowTheRequestLanguage() throws Exception {
        wrongLogin("en").andExpect(jsonPath("$.title").value("Invalid credentials"))
                .andExpect(jsonPath("$.detail").value("Incorrect username, email or password."));
        wrongLogin("es-ES,es;q=0.9").andExpect(jsonPath("$.title").value("Credenciales no válidas"));
        wrongLogin("it").andExpect(jsonPath("$.title").value("Credenziali non valide"));
        wrongLogin(null).andExpect(jsonPath("$.title").value("Credenziali non valide"));
    }

    @Test
    void unsupportedOrMalformedLanguagesFallBackToItalian() throws Exception {
        wrongLogin("fr-FR,fr;q=0.9").andExpect(jsonPath("$.title").value("Credenziali non valide"));
        wrongLogin(",,;q=x").andExpect(jsonPath("$.title").value("Credenziali non valide"));
        wrongLogin("*").andExpect(jsonPath("$.title").value("Credenziali non valide"));
    }

    @Test
    void malformedHeaderOnTheRealServerIsItalianNotA500() {
        RawHttp http = new RawHttp(port);
        for (String header : new String[] { ",,;q=x", "en;q=abc", "fr-FR,fr;q=0.9", "xx-@@" }) {
            HttpResponse<String> response = http.post("/api/auth/login",
                    RawHttp.loginBody("nobody_" + TestApi.uniqueName(), "Wrong-password-1"),
                    "Accept-Language", header);
            assertThat(response.statusCode()).as(header).isEqualTo(401);
            assertThat(response.body()).as(header).contains("Credenziali non valide");
        }
    }

    @Test
    void oversizedOrPathologicalHeadersOnTheRealServerAreItalianNotA500() {
        RawHttp http = new RawHttp(port);
        String manyRanges = String.join(",", java.util.Collections.nCopies(880, "fr;q=0.5"));
        String large = "x".repeat(8 * 1024);
        for (String header : new String[] { manyRanges, large, "en;q=NaN", "en;q=0", "es;q=0,fr" }) {
            HttpResponse<String> response = http.post("/api/auth/login",
                    RawHttp.loginBody("nobody_" + TestApi.uniqueName(), "Wrong-password-1"),
                    "Accept-Language", header);
            String as = header.substring(0, Math.min(40, header.length()));
            assertThat(response.statusCode()).as(as).isBetween(200, 499);
            if (response.statusCode() == 401) {
                assertThat(response.body()).as(as).contains("Credenziali non valide");
            }
        }
    }

    @Test
    void beanValidationAndPasswordRulesAreLocalized() throws Exception {
        String name = TestApi.uniqueName();
        mvc.perform(post("/api/auth/register").header("Accept-Language", "es")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"%s\",\"email\":\"%s@mail.it\",\"password\":\"Zq8#wK1!\"}"
                                .formatted(name, name)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.title").value("Datos no válidos"))
                .andExpect(jsonPath("$.errors.password")
                        .value("La contraseña debe tener al menos 12 caracteres."));

        mvc.perform(post("/api/auth/register").header("Accept-Language", "en")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"a!\",\"email\":\"not-an-email\",\"password\":\"x\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.title").value("Invalid data"))
                .andExpect(jsonPath("$.detail").value("One or more fields are invalid."))
                .andExpect(jsonPath("$.errors.username").value("The username must have 3 to 20 characters among letters, numbers and _."))
                .andExpect(jsonPath("$.errors.email").value("The email is not valid."));

        mvc.perform(post("/api/auth/register").header("Accept-Language", "it")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"a!\",\"email\":\"a@mail.it\",\"password\":\"x\"}"))
                .andExpect(jsonPath("$.errors.username").value("Lo username deve avere da 3 a 20 caratteri tra lettere, numeri e _."));
    }

    @Test
    void localeUpdateErrorsAndFilterErrorsAreLocalized() throws Exception {
        Account account = api.registerVerified();
        Session session = api.loginSession(account);
        mvc.perform(put("/api/me/locale").header("Authorization", session.bearer())
                        .header("Accept-Language", "en").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"locale\":\"fr\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.locale").value("Unsupported language."));

        mvc.perform(get("/api/me").header("Accept-Language", "es"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.title").value("No autenticado"));
        mvc.perform(get("/api/nope").header("Authorization", session.bearer()).header("Accept-Language", "en"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.title").value("Not found"));
    }

    @Test
    void successMessagesAreLocalized() throws Exception {
        mvc.perform(post("/api/auth/forgot-password").header("Accept-Language", "en")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"email\":\"nobody@mail.it\"}"))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.message").value("If the address is registered, you will receive an email."));
    }
}
