package com.nightcrawlers.auth;

import static org.hamcrest.Matchers.matchesPattern;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import com.nightcrawlers.support.CapturingMailService;
import com.nightcrawlers.support.IntegrationTest;
import com.nightcrawlers.support.TestApi;
import com.nightcrawlers.support.TestApi.Account;

/** Low limits in a dedicated context, so the other integration tests keep the generous test limits. */
@IntegrationTest
@TestPropertySource(properties = {
        "app.rate-limit.login-ip.capacity=3", "app.rate-limit.login-ip.period=PT1M",
        "app.rate-limit.login-account.capacity=5", "app.rate-limit.login-account.period=PT15M",
        "app.rate-limit.forgot-account.capacity=2", "app.rate-limit.forgot-account.period=PT1H" })
class RateLimitIT {

    @Autowired
    MockMvc mvc;
    @Autowired
    CapturingMailService mail;

    TestApi api;

    @BeforeEach
    void setUp() {
        api = new TestApi(mvc, mail);
    }

    ResultActions login(Account account, String ip) throws Exception {
        return mvc.perform(post("/api/auth/login").header("X-Forwarded-For", ip)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"login\":\"%s\",\"password\":\"%s\"}".formatted(account.username(), account.password())));
    }

    @Test
    void fourthLoginFromTheSameIpWithinAMinuteIsTooManyRequests() throws Exception {
        Account account = api.register();
        for (int i = 0; i < 3; i++) {
            login(account, "198.51.100.1").andExpect(status().isOk());
        }

        login(account, "198.51.100.1")
                .andExpect(status().isTooManyRequests())
                .andExpect(header().string("Retry-After", matchesPattern("[1-9][0-9]*")))
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.status").value(429))
                .andExpect(jsonPath("$.title").value("Troppe richieste"));

        login(api.register(), "198.51.100.2").andExpect(status().isOk());
    }

    @Test
    void sameAccountFromManyIpsHitsTheAccountLimit() throws Exception {
        Account account = api.register();
        for (int i = 1; i <= 5; i++) {
            login(account, "203.0.113." + i).andExpect(status().isOk());
        }
        login(account, "203.0.113.99").andExpect(status().isTooManyRequests());
        // the account key is normalized: the email of the same account counts too
        mvc.perform(post("/api/auth/login").header("X-Forwarded-For", "203.0.113.100")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"login\":\"%s\",\"password\":\"x\"}".formatted(account.username().toUpperCase())))
                .andExpect(status().isTooManyRequests());
    }

    @Test
    void forgotPasswordIsLimitedPerAccount() throws Exception {
        String email = TestApi.uniqueName() + "@mail.it";
        for (int i = 1; i <= 2; i++) {
            mvc.perform(post("/api/auth/forgot-password").header("X-Forwarded-For", "192.0.2." + i)
                    .contentType(MediaType.APPLICATION_JSON).content("{\"email\":\"" + email + "\"}"))
                    .andExpect(status().isAccepted());
        }
        mvc.perform(post("/api/auth/forgot-password").header("X-Forwarded-For", "192.0.2.50")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"email\":\" " + email.toUpperCase() + "\"}"))
                .andExpect(status().isTooManyRequests());
    }
}
