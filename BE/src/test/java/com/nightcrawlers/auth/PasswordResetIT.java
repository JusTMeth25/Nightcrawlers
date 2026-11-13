package com.nightcrawlers.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Duration;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import com.nightcrawlers.support.CapturingMailService;
import com.nightcrawlers.support.IntegrationTest;
import com.nightcrawlers.support.MutableClock;
import com.nightcrawlers.support.TestApi;
import com.nightcrawlers.support.TestApi.Account;
import com.nightcrawlers.support.TestApi.Session;

import jakarta.servlet.http.Cookie;

@IntegrationTest
class PasswordResetIT {

    static final String NEW_PASSWORD = "Qz8!mW3#rT6&";
    static final String MESSAGE = "Se l'indirizzo è registrato, riceverai un'email.";

    @Autowired
    MockMvc mvc;
    @Autowired
    CapturingMailService mail;
    @Autowired
    MutableClock clock;

    TestApi api;

    @BeforeEach
    void setUp() {
        clock.reset();
        api = new TestApi(mvc, mail);
    }

    ResultActions forgot(String email) throws Exception {
        return mvc.perform(post("/api/auth/forgot-password").contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"" + email + "\"}"));
    }

    ResultActions reset(String token, String password) throws Exception {
        return mvc.perform(post("/api/auth/reset-password").contentType(MediaType.APPLICATION_JSON)
                .content("{\"token\":\"" + token + "\",\"newPassword\":\"" + password + "\"}"));
    }

    String requestResetToken(Account account) throws Exception {
        forgot(account.email()).andExpect(status().isAccepted());
        CapturingMailService.Mail sent = mail.lastTo(account.email());
        assertThat(sent.html()).contains("http://localhost:5173/reset-password?token=");
        return sent.token().orElseThrow();
    }

    @Test
    void unknownEmailIsAcceptedWithoutEmail() throws Exception {
        String email = TestApi.uniqueName() + "@mail.it";
        forgot(email)
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.message").value(MESSAGE));
        assertThat(mail.to(email)).isEmpty();
    }

    @Test
    void knownEmailGetsTheSameAnswerAndOneEmail() throws Exception {
        Account account = api.register();
        int before = mail.to(account.email()).size();

        forgot(" " + account.email().toUpperCase() + " ")
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.message").value(MESSAGE));

        assertThat(mail.to(account.email())).hasSize(before + 1);
    }

    @Test
    void resetChangesThePasswordAndRevokesEverySession() throws Exception {
        Account account = api.register();
        Session session = api.loginSession(account);
        String token = requestResetToken(account);

        reset(token, NEW_PASSWORD).andExpect(status().isNoContent());

        api.login(account.username(), NEW_PASSWORD).andExpect(status().isOk());
        api.login(account.username(), account.password()).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/auth/refresh")
                        .cookie(new Cookie("refresh_token", session.refreshToken()),
                                new Cookie("XSRF-TOKEN", session.csrfToken()))
                        .header("X-CSRF-Token", session.csrfToken()))
                .andExpect(status().isUnauthorized());

        reset(token, "Another#Pass987").andExpect(status().isBadRequest());
    }

    @Test
    void weakPasswordIsRejectedAndTheTokenStaysUsable() throws Exception {
        Account account = api.register();
        String token = requestResetToken(account);

        reset(token, "password1234")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.password").isString());
        reset(token, account.username() + "#Xy12345")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.password").isString());

        reset(token, NEW_PASSWORD).andExpect(status().isNoContent());
    }

    @Test
    void expiredResetTokenIsRejected() throws Exception {
        Account account = api.register();
        String token = requestResetToken(account);
        clock.advance(Duration.ofMinutes(31));
        reset(token, NEW_PASSWORD).andExpect(status().isBadRequest());
    }

    @Test
    void resendVerificationSendsOnlyToUnverifiedUsers() throws Exception {
        Account unverified = api.register();
        Session s1 = api.loginSession(unverified);
        int before = mail.to(unverified.email()).size();
        mvc.perform(post("/api/auth/resend-verification").header("Authorization", s1.bearer()))
                .andExpect(status().isAccepted());
        assertThat(mail.to(unverified.email())).hasSize(before + 1);
        assertThat(mail.lastTo(unverified.email()).html()).contains("/verify-email?token=");

        Account verified = api.registerVerified();
        Session s2 = api.loginSession(verified);
        int sent = mail.to(verified.email()).size();
        mvc.perform(post("/api/auth/resend-verification").header("Authorization", s2.bearer()))
                .andExpect(status().isAccepted());
        assertThat(mail.to(verified.email())).hasSize(sent);
    }

    @Test
    void resendVerificationRequiresBearer() throws Exception {
        mvc.perform(post("/api/auth/resend-verification")).andExpect(status().isUnauthorized());
    }

    @Test
    void resetEmailUsesTheAccountLanguageNotTheRequestOne() throws Exception {
        String name = TestApi.uniqueName();
        String email = name + "@mail.it";
        mvc.perform(post("/api/auth/register").header("Accept-Language", "it")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"%s\",\"email\":\"%s\",\"password\":\"%s\",\"locale\":\"en\"}"
                                .formatted(name, email, TestApi.PASSWORD)))
                .andExpect(status().isAccepted());
        CapturingMailService.Mail verification = mail.lastTo(email);
        assertThat(verification.subject()).isEqualTo("Confirm your email address - Nightcrawlers");
        assertThat(verification.html()).contains("Confirm your email");

        mvc.perform(post("/api/auth/forgot-password").header("Accept-Language", "es")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"email\":\"" + email + "\"}"))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.message").value("Si la dirección está registrada, recibirás un correo."));

        CapturingMailService.Mail reset = mail.lastTo(email);
        assertThat(reset.subject()).isEqualTo("Reset your password - Nightcrawlers");
        assertThat(reset.html()).contains("Reset your password").doesNotContain("Restablece");
        assertThat(reset.text()).contains("Hi " + name).doesNotContain("Hola");
    }

    @Test
    void alreadyRegisteredEmailUsesTheExistingAccountLanguage() throws Exception {
        String name = TestApi.uniqueName();
        String email = name + "@mail.it";
        String body = "{\"username\":\"%s\",\"email\":\"%s\",\"password\":\"%s\",\"locale\":\"%s\"}";
        mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                .content(body.formatted(name, email, TestApi.PASSWORD, "es"))).andExpect(status().isAccepted());
        assertThat(mail.lastTo(email).subject()).isEqualTo("Confirma tu dirección de correo - Nightcrawlers");

        mvc.perform(post("/api/auth/register").header("Accept-Language", "en").contentType(MediaType.APPLICATION_JSON)
                .content(body.formatted(TestApi.uniqueName(), email, TestApi.PASSWORD, "en")))
                .andExpect(status().isAccepted());
        CapturingMailService.Mail attempt = mail.lastTo(email);
        assertThat(attempt.subject()).isEqualTo("Intento de registro - Nightcrawlers");
        assertThat(attempt.text()).contains("Hola " + name);
    }
}
