package com.nightcrawlers.auth;

import static org.assertj.core.api.Assertions.assertThat;
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
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import com.nightcrawlers.support.CapturingMailService;
import com.nightcrawlers.support.IntegrationTest;
import com.nightcrawlers.support.RawHttp;
import com.nightcrawlers.support.TestApi;
import com.nightcrawlers.support.TestApi.Account;

/** Low limits in a dedicated context, so the other integration tests keep the generous test limits. */
@IntegrationTest
@TestPropertySource(properties = {
        "app.rate-limit.login-ip.capacity=3", "app.rate-limit.login-ip.period=PT1M",
        "app.rate-limit.login-account.capacity=5", "app.rate-limit.login-account.period=PT15M",
        "app.rate-limit.forgot-account.capacity=2", "app.rate-limit.forgot-account.period=PT1H",
        // loopback is NOT a trusted proxy in this context: real-HTTP calls come from an untrusted client
        "server.tomcat.remoteip.internal-proxies=192[.]0[.]2[.]250" })
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

    @LocalServerPort
    int port;

    static RequestPostProcessor from(String ip) {
        return request -> {
            request.setRemoteAddr(ip);
            return request;
        };
    }

    ResultActions login(Account account, String ip) throws Exception {
        return mvc.perform(post("/api/auth/login").with(from(ip))
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
        mvc.perform(post("/api/auth/login").with(from("203.0.113.100"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"login\":\"%s\",\"password\":\"x\"}".formatted(account.username().toUpperCase())))
                .andExpect(status().isTooManyRequests());
    }

    @Test
    void forgotPasswordIsLimitedPerAccount() throws Exception {
        String email = TestApi.uniqueName() + "@mail.it";
        for (int i = 1; i <= 2; i++) {
            mvc.perform(post("/api/auth/forgot-password").with(from("192.0.2." + i))
                    .contentType(MediaType.APPLICATION_JSON).content("{\"email\":\"" + email + "\"}"))
                    .andExpect(status().isAccepted());
        }
        mvc.perform(post("/api/auth/forgot-password").with(from("192.0.2.50"))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"email\":\" " + email.toUpperCase() + "\"}"))
                .andExpect(status().isTooManyRequests());
    }

    @Test
    void spoofedForwardingHeadersFromAnUntrustedClientShareOneBucket() throws Exception {
        RawHttp http = new RawHttp(port);
        Account account = api.register();
        String body = RawHttp.loginBody(account.username(), account.password());
        String[][] spoofs = { { "X-Forwarded-For", "10.9.8.1" }, { "Forwarded", "for=10.9.8.2" },
                { "X-Forwarded-For", "10.9.8.3, 10.9.8.4" } };
        for (String[] spoof : spoofs) {
            assertThat(http.post("/api/auth/login", body, spoof[0], spoof[1]).statusCode()).isEqualTo(200);
        }
        assertThat(http.post("/api/auth/login", body, "X-Forwarded-For", "10.9.8.5").statusCode()).isEqualTo(429);
    }
}
