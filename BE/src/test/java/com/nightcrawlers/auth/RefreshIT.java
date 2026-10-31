package com.nightcrawlers.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import com.nightcrawlers.common.SecureTokens;
import com.nightcrawlers.common.audit.AuditEvent;
import com.nightcrawlers.common.audit.AuditLogRepository;
import com.nightcrawlers.support.CapturingMailService;
import com.nightcrawlers.support.IntegrationTest;
import com.nightcrawlers.support.MutableClock;
import com.nightcrawlers.support.TestApi;
import com.nightcrawlers.support.TestApi.Session;

import jakarta.servlet.http.Cookie;

@IntegrationTest
class RefreshIT {

    @Autowired
    MockMvc mvc;
    @Autowired
    CapturingMailService mail;
    @Autowired
    MutableClock clock;
    @Autowired
    RefreshTokenRepository refreshTokens;
    @Autowired
    AuditLogRepository auditLog;

    TestApi api;

    @BeforeEach
    void setUp() {
        clock.reset();
        api = new TestApi(mvc, mail);
    }

    ResultActions refresh(String refreshToken, String csrfCookie, String csrfHeader) throws Exception {
        var request = post("/api/auth/refresh").cookie(new Cookie("refresh_token", refreshToken));
        if (csrfCookie != null) {
            request.cookie(new Cookie("XSRF-TOKEN", csrfCookie));
        }
        if (csrfHeader != null) {
            request.header("X-CSRF-Token", csrfHeader);
        }
        return mvc.perform(request);
    }

    ResultActions refresh(Session session) throws Exception {
        return refresh(session.refreshToken(), session.csrfToken(), session.csrfToken());
    }

    @Test
    void validRefreshRotatesTheToken() throws Exception {
        Session first = api.loginSession(api.register());

        var result = refresh(first)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").isString())
                .andExpect(jsonPath("$.expiresInSec").value(900))
                .andExpect(jsonPath("$.user.username").isString())
                .andReturn();
        Session second = TestApi.session(result);

        assertThat(second.refreshToken()).isNotEqualTo(first.refreshToken());
        assertThat(second.csrfToken()).isNotEqualTo(first.csrfToken());
        assertThat(refreshTokens.findByTokenHash(SecureTokens.sha256Hex(first.refreshToken())).orElseThrow()
                .getUsedAt()).isNotNull();
        assertThat(TestApi.attributes(TestApi.setCookie(result.getResponse(), "refresh_token").orElseThrow()))
                .contains("HttpOnly", "Path=/api/auth");
    }

    @Test
    void reusingAnOldTokenRevokesTheWholeFamily() throws Exception {
        Session first = api.loginSession(api.register());
        Session second = TestApi.session(refresh(first).andExpect(status().isOk()).andReturn());
        long reusesBefore = auditLog.countByEvent(AuditEvent.REFRESH_REUSE);

        refresh(first)
                .andExpect(status().isUnauthorized())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON));
        refresh(second).andExpect(status().isUnauthorized());

        assertThat(auditLog.countByEvent(AuditEvent.REFRESH_REUSE)).isEqualTo(reusesBefore + 1);
    }

    @Test
    void concurrentRefreshesWithTheSameTokenLetExactlyOneThrough() throws Exception {
        Session session = api.loginSession(api.register());
        CountDownLatch start = new CountDownLatch(1);

        List<CompletableFuture<Integer>> calls = List.of(1, 2).stream()
                .map(i -> CompletableFuture.supplyAsync(() -> {
                    try {
                        start.await();
                        return refresh(session).andReturn().getResponse().getStatus();
                    } catch (Exception e) {
                        throw new IllegalStateException(e);
                    }
                }))
                .toList();
        start.countDown();
        List<Integer> statuses = calls.stream().map(CompletableFuture::join).toList();

        assertThat(statuses).containsExactlyInAnyOrder(200, 401);
    }

    @Test
    void missingOrMismatchedCsrfHeaderIsForbidden() throws Exception {
        Session session = api.loginSession(api.register());

        refresh(session.refreshToken(), session.csrfToken(), null)
                .andExpect(status().isForbidden())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON));
        refresh(session.refreshToken(), session.csrfToken(), session.csrfToken() + "x")
                .andExpect(status().isForbidden());
        refresh(session.refreshToken(), null, session.csrfToken())
                .andExpect(status().isForbidden());

        // the token was never consumed by the rejected calls
        refresh(session).andExpect(status().isOk());
    }

    @Test
    void missingRefreshCookieIsUnauthorized() throws Exception {
        mvc.perform(post("/api/auth/refresh").cookie(new Cookie("XSRF-TOKEN", "abc")).header("X-CSRF-Token", "abc"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void expiredRefreshTokenIsUnauthorized() throws Exception {
        Session session = api.loginSession(api.register());
        clock.advance(java.time.Duration.ofDays(30).plusSeconds(1));
        refresh(session).andExpect(status().isUnauthorized());
    }

    @Test
    void logoutRevokesTheSessionAndClearsCookies() throws Exception {
        Session session = api.loginSession(api.register());

        MockHttpServletResponse response = mvc.perform(post("/api/auth/logout")
                        .cookie(new Cookie("refresh_token", session.refreshToken()),
                                new Cookie("XSRF-TOKEN", session.csrfToken()))
                        .header("X-CSRF-Token", session.csrfToken()))
                .andExpect(status().isNoContent())
                .andReturn().getResponse();

        assertThat(TestApi.attributes(TestApi.setCookie(response, "refresh_token").orElseThrow()))
                .contains("refresh_token=", "Max-Age=0", "Path=/api/auth");
        assertThat(TestApi.attributes(TestApi.setCookie(response, "XSRF-TOKEN").orElseThrow()))
                .contains("XSRF-TOKEN=", "Max-Age=0");
        refresh(session).andExpect(status().isUnauthorized());
    }

    @Test
    void logoutRequiresCsrf() throws Exception {
        Session session = api.loginSession(api.register());
        mvc.perform(post("/api/auth/logout").cookie(new Cookie("refresh_token", session.refreshToken())))
                .andExpect(status().isForbidden());
        refresh(session).andExpect(status().isOk());
    }

    @Test
    void logoutAllRevokesEveryFamily() throws Exception {
        TestApi.Account account = api.register();
        Session laptop = api.loginSession(account);
        Session phone = api.loginSession(account);

        mvc.perform(post("/api/auth/logout-all").header("Authorization", phone.bearer()))
                .andExpect(status().isNoContent());

        refresh(laptop).andExpect(status().isUnauthorized());
        refresh(phone).andExpect(status().isUnauthorized());
    }

    @Test
    void logoutAllRequiresBearer() throws Exception {
        mvc.perform(post("/api/auth/logout-all")).andExpect(status().isUnauthorized());
    }
}
