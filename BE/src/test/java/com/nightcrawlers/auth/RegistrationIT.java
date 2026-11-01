package com.nightcrawlers.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Duration;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import com.nightcrawlers.save.PlayerSaveRepository;
import com.nightcrawlers.save.UnlockedCharacterRepository;
import com.nightcrawlers.support.CapturingMailService;
import com.nightcrawlers.support.IntegrationTest;
import com.nightcrawlers.support.MutableClock;
import com.nightcrawlers.user.User;
import com.nightcrawlers.user.UserRepository;

@IntegrationTest
class RegistrationIT {

    static final String PASSWORD = "Vy7#kq2!Lp9z";

    @Autowired
    MockMvc mvc;
    @Autowired
    UserRepository users;
    @Autowired
    PlayerSaveRepository saves;
    @Autowired
    UnlockedCharacterRepository unlocked;
    @Autowired
    CapturingMailService mail;
    @Autowired
    MutableClock clock;

    @BeforeEach
    void resetClock() {
        clock.reset();
    }

    static String unique() {
        return "u" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
    }

    ResultActions register(String username, String email, String password) throws Exception {
        String body = """
                {"username":"%s","email":"%s","password":"%s"}""".formatted(username, email, password);
        return mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON).content(body));
    }

    ResultActions verify(String token) throws Exception {
        return mvc.perform(post("/api/auth/verify-email").contentType(MediaType.APPLICATION_JSON)
                .content("{\"token\":\"" + token + "\"}"));
    }

    @Test
    void validRegistrationCreatesUnverifiedUserWithStartersAndSendsVerificationEmail() throws Exception {
        String name = unique();
        String email = name + "@mail.it";

        register(name, email, PASSWORD)
                .andExpect(status().isAccepted())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.message").isString());

        User user = users.findByEmail(email).orElseThrow();
        assertThat(user.isEmailVerified()).isFalse();
        assertThat(user.getPasswordHash()).startsWith("$argon2id$");
        assertThat(saves.findById(user.getId())).hasValueSatisfying(s -> assertThat(s.getEurodollars()).isZero());
        assertThat(unlocked.findByUserId(user.getId())).extracting(u -> u.getCharacterId())
                .containsExactlyInAnyOrder("david", "lucy", "rebecca");
        assertThat(mail.to(email)).hasSize(1);
        assertThat(mail.lastTo(email).html()).contains("http://localhost:5173/verify-email?token=");
        assertThat(mail.lastTo(email).token()).isPresent();
    }

    @Test
    void emailIsTrimmedAndLowercased() throws Exception {
        String name = unique();
        register(name, " Mario." + name.toUpperCase() + "@Mail.IT ", PASSWORD)
                .andExpect(status().isAccepted());

        String normalized = "mario." + name + "@mail.it";
        assertThat(users.findByEmail(normalized)).isPresent();
        assertThat(mail.to(normalized)).hasSize(1);
    }

    @Test
    void duplicateEmailAnswersIdenticallyWithoutCreatingUserAndSendsNotice() throws Exception {
        String name = unique();
        String email = name + "@mail.it";
        String first = register(name, email, PASSWORD).andExpect(status().isAccepted())
                .andReturn().getResponse().getContentAsString();
        long before = users.count();

        String second = register(unique(), " " + email.toUpperCase() + " ", PASSWORD)
                .andExpect(status().isAccepted())
                .andReturn().getResponse().getContentAsString();

        assertThat(second).isEqualTo(first);
        assertThat(users.count()).isEqualTo(before);
        assertThat(mail.to(email)).hasSize(2);
        assertThat(mail.lastTo(email).html()).contains("qualcuno ha provato a registrarsi");
        assertThat(mail.lastTo(email).token()).isEmpty();
    }

    @Test
    void duplicateUsernameWithDifferentCaseIsConflict() throws Exception {
        String name = unique();
        register(name, name + "@mail.it", PASSWORD).andExpect(status().isAccepted());

        register(name.toUpperCase(), unique() + "@mail.it", PASSWORD)
                .andExpect(status().isConflict())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON));
    }

    @Test
    void weakPasswordIsBadRequestWithFieldError() throws Exception {
        String name = unique();
        register(name, name + "@mail.it", "password1234")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.password").isString());
        register(name, name + "@mail.it", "short")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.password").isString());
        assertThat(users.findByEmail(name + "@mail.it")).isEmpty();
    }

    @Test
    void invalidUsernameAndEmailAreBadRequest() throws Exception {
        register("a b", unique() + "@mail.it", PASSWORD)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.username").isString());
        register(unique(), "not-an-email", PASSWORD)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.email").isString());
    }

    @Test
    void verificationTokenVerifiesOnce() throws Exception {
        String name = unique();
        String email = name + "@mail.it";
        register(name, email, PASSWORD).andExpect(status().isAccepted());
        String token = mail.lastTo(email).token().orElseThrow();

        verify(token).andExpect(status().isNoContent());
        assertThat(users.findByEmail(email).orElseThrow().isEmailVerified()).isTrue();

        verify(token)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.title").value("Token non valido o scaduto"));
    }

    @Test
    void expiredVerificationTokenIsRejected() throws Exception {
        String name = unique();
        String email = name + "@mail.it";
        register(name, email, PASSWORD).andExpect(status().isAccepted());
        String token = mail.lastTo(email).token().orElseThrow();

        clock.advance(Duration.ofMinutes(31));

        verify(token).andExpect(status().isBadRequest());
        assertThat(users.findByEmail(email).orElseThrow().isEmailVerified()).isFalse();
    }

    @Test
    void unknownTokenIsRejected() throws Exception {
        verify("does-not-exist").andExpect(status().isBadRequest());
    }
}
