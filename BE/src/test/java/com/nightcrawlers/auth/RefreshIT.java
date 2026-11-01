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
import org.springframework.test.web.servlet.MvcResult;
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

    private long liveTokensOfFamilyOf(Session session) {
        RefreshToken any = refreshTokens.findByTokenHash(SecureTokens.sha256Hex(session.refreshToken())).orElseThrow();
        return refreshTokens.findByUserId(any.getUserId()).stream()
                .filter(t -> t.getFamilyId().equals(any.getFamilyId()))
                .filter(t -> t.getUsedAt() == null && t.getRevokedAt() == null)
                .count();
    }

    @Test
    void reusingAnOldTokenAfterTheGraceWindowRevokesTheWholeFamily() throws Exception {
        Session first = api.loginSession(api.register());
        Session second = TestApi.session(refresh(first).andExpect(status().isOk()).andReturn());
        long reusesBefore = auditLog.countByEvent(AuditEvent.REFRESH_REUSE);
        clock.advance(java.time.Duration.ofSeconds(21));

        refresh(first)
                .andExpect(status().isUnauthorized())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON));
        refresh(second).andExpect(status().isUnauthorized());

        assertThat(auditLog.countByEvent(AuditEvent.REFRESH_REUSE)).isEqualTo(reusesBefore + 1);
    }

    @Test
    void reuseWithinTheGraceWindowIssuesANewSuccessorWithoutRevoking() throws Exception {
        // a reload before the refresh response arrived: the browser still holds the old cookie
        Session first = api.loginSession(api.register());
        Session lost = TestApi.session(refresh(first).andExpect(status().isOk()).andReturn());
        long reusesBefore = auditLog.countByEvent(AuditEvent.REFRESH_REUSE);
        long gracesBefore = auditLog.countByEvent(AuditEvent.REFRESH_GRACE);
        clock.advance(java.time.Duration.ofSeconds(19));

        Session retried = TestApi.session(refresh(first).andExpect(status().isOk()).andReturn());

        assertThat(retried.refreshToken()).isNotEqualTo(lost.refreshToken());
        assertThat(auditLog.countByEvent(AuditEvent.REFRESH_GRACE)).isEqualTo(gracesBefore + 1);
        assertThat(auditLog.countByEvent(AuditEvent.REFRESH_REUSE)).isEqualTo(reusesBefore);
        assertThat(liveTokensOfFamilyOf(first)).isEqualTo(1);
        // only the newest successor stays valid; the superseded one does not revoke the family
        refresh(lost).andExpect(status().isUnauthorized());
        refresh(retried).andExpect(status().isOk());
        assertThat(auditLog.countByEvent(AuditEvent.REFRESH_REUSE)).isEqualTo(reusesBefore);
    }

    @Test
    void reuseAfterTheSuccessorWasUsedRevokesTheFamilyEvenWithinTheWindow() throws Exception {
        Session first = api.loginSession(api.register());
        Session second = TestApi.session(refresh(first).andExpect(status().isOk()).andReturn());
        Session third = TestApi.session(refresh(second).andExpect(status().isOk()).andReturn());
        long reusesBefore = auditLog.countByEvent(AuditEvent.REFRESH_REUSE);

        refresh(first).andExpect(status().isUnauthorized());
        refresh(third).andExpect(status().isUnauthorized());
        assertThat(auditLog.countByEvent(AuditEvent.REFRESH_REUSE)).isEqualTo(reusesBefore + 1);
    }

    @Test
    void reuseOfARevokedFamilyIsRefusedWithinTheWindow() throws Exception {
        Session first = api.loginSession(api.register());
        refresh(first).andExpect(status().isOk());
        mvc.perform(post("/api/auth/logout")
                        .cookie(new Cookie("refresh_token", first.refreshToken()),
                                new Cookie("XSRF-TOKEN", first.csrfToken()))
                        .header("X-CSRF-Token", first.csrfToken()))
                .andExpect(status().isNoContent());

        refresh(first).andExpect(status().isUnauthorized());
    }

    @Test
    void concurrentRefreshesWithTheSameTokenAllSucceedAndLeaveOneValidSuccessor() throws Exception {
        Session session = api.loginSession(api.register());
        long reusesBefore = auditLog.countByEvent(AuditEvent.REFRESH_REUSE);
        CountDownLatch start = new CountDownLatch(1);

        List<CompletableFuture<MvcResult>> calls = List.of(1, 2, 3, 4).stream()
                .map(i -> CompletableFuture.supplyAsync(() -> {
                    try {
                        start.await();
                        return refresh(session).andReturn();
                    } catch (Exception e) {
                        throw new IllegalStateException(e);
                    }
                }))
                .toList();
        start.countDown();
        List<MvcResult> results = calls.stream().map(CompletableFuture::join).toList();

        assertThat(results).extracting(r -> r.getResponse().getStatus()).containsOnly(200);
        assertThat(liveTokensOfFamilyOf(session)).isEqualTo(1);
        assertThat(auditLog.countByEvent(AuditEvent.REFRESH_REUSE)).isEqualTo(reusesBefore);
        List<Integer> next = results.stream().map(r -> {
            try {
                return refresh(TestApi.session(r)).andReturn().getResponse().getStatus();
            } catch (Exception e) {
                throw new IllegalStateException(e);
            }
        }).toList();
        assertThat(next).containsExactlyInAnyOrder(200, 401, 401, 401);
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
    void sessionFamilyHasAnAbsoluteLifetimeOfNinetyDays() throws Exception {
        Session session = api.loginSession(api.register());
        for (int i = 0; i < 2; i++) {
            clock.advance(java.time.Duration.ofDays(29));
            session = TestApi.session(refresh(session).andExpect(status().isOk()).andReturn());
        }
        clock.advance(java.time.Duration.ofDays(29)); // day 87: successor capped at day 90
        MvcResult last = refresh(session).andExpect(status().isOk()).andReturn();
        String maxAge = TestApi.attributes(TestApi.setCookie(last.getResponse(), "refresh_token").orElseThrow())
                .stream().filter(a -> a.startsWith("Max-Age=")).findFirst().orElseThrow();
        assertThat(Long.parseLong(maxAge.substring("Max-Age=".length()))).isLessThanOrEqualTo(3 * 86_400);

        clock.advance(java.time.Duration.ofDays(4)); // day 91
        refresh(TestApi.session(last)).andExpect(status().isUnauthorized());
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
