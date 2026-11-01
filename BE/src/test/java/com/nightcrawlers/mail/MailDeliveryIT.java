package com.nightcrawlers.mail;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import com.nightcrawlers.support.CapturingMailService;
import com.nightcrawlers.support.IntegrationTest;
import com.nightcrawlers.support.TestApi;
import com.nightcrawlers.support.TestApi.Account;

/** A slow SMTP relay must not show in response times (no account enumeration by timing). */
@IntegrationTest
class MailDeliveryIT {

    @Autowired
    MockMvc mvc;
    @Autowired
    CapturingMailService mail;

    TestApi api;

    @BeforeEach
    void setUp() {
        api = new TestApi(mvc, mail);
    }

    int forgot(String email) {
        CompletableFuture<Integer> call = CompletableFuture.supplyAsync(() -> {
            try {
                return mvc.perform(post("/api/auth/forgot-password").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\"}")).andReturn().getResponse().getStatus();
            } catch (Exception e) {
                throw new IllegalStateException(e);
            }
        });
        try {
            return call.get(3, TimeUnit.SECONDS);
        } catch (Exception e) {
            throw new AssertionError("forgot-password waited for the mail relay", e);
        }
    }

    @Test
    void forgotPasswordAnswersWithoutWaitingForSmtpAndStillDelivers() {
        Account account;
        try {
            account = api.register();
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
        CountDownLatch slowRelay = mail.blockSends();
        try {
            assertThat(forgot(account.email())).isEqualTo(202);
            assertThat(forgot(TestApi.uniqueName() + "@mail.it")).isEqualTo(202);
        } finally {
            mail.unblock(slowRelay);
        }
        assertThat(mail.lastTo(account.email()).html()).contains("/reset-password?token=");
    }

    @Test
    void registrationAnswersWithoutWaitingForSmtp() throws Exception {
        CountDownLatch slowRelay = mail.blockSends();
        Account account;
        try {
            account = CompletableFuture.supplyAsync(() -> {
                try {
                    return api.register();
                } catch (Exception e) {
                    throw new IllegalStateException(e);
                }
            }).get(3, TimeUnit.SECONDS);
        } finally {
            mail.unblock(slowRelay);
        }
        assertThat(mail.lastTo(account.email()).token()).isPresent();
    }
}
