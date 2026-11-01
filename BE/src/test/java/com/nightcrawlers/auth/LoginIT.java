package com.nightcrawlers.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.List;

import javax.crypto.spec.SecretKeySpec;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.test.web.servlet.MockMvc;

import com.nightcrawlers.support.CapturingMailService;
import com.nightcrawlers.support.IntegrationTest;
import com.nightcrawlers.support.MutableClock;
import com.nightcrawlers.support.TestApi;
import com.nightcrawlers.support.TestApi.Account;
import com.nightcrawlers.user.UserRepository;

@IntegrationTest
class LoginIT {

    @Autowired
    MockMvc mvc;
    @Autowired
    CapturingMailService mail;
    @Autowired
    MutableClock clock;
    @Autowired
    UserRepository users;

    TestApi api;

    @BeforeEach
    void setUp() {
        clock.reset();
        api = new TestApi(mvc, mail);
    }

    @Test
    void loginWithUsernameReturnsAccessTokenAndHardenedCookies() throws Exception {
        Account account = api.register();

        MockHttpServletResponse response = api.login(account.username(), account.password())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").isString())
                .andExpect(jsonPath("$.expiresInSec").value(900))
                .andExpect(jsonPath("$.user.username").value(account.username()))
                .andExpect(jsonPath("$.user.email").value(account.email()))
                .andExpect(jsonPath("$.user.emailVerified").value(false))
                .andExpect(jsonPath("$.user.id").isString())
                .andExpect(jsonPath("$.user.createdAt").isString())
                .andReturn().getResponse();

        List<String> refresh = TestApi.attributes(TestApi.setCookie(response, "refresh_token").orElseThrow());
        assertThat(refresh).contains("HttpOnly", "Secure", "SameSite=Strict", "Path=/api/auth", "Max-Age=2592000");
        assertThat(refresh.getFirst().substring("refresh_token=".length())).matches("[A-Za-z0-9_-]{43}");

        List<String> csrf = TestApi.attributes(TestApi.setCookie(response, "XSRF-TOKEN").orElseThrow());
        assertThat(csrf).contains("Secure", "SameSite=Strict", "Path=/").doesNotContain("HttpOnly");
        assertThat(csrf.getFirst().substring("XSRF-TOKEN=".length())).matches("[A-Za-z0-9_-]{43}");
    }

    @Test
    void loginWithEmailIsNormalized() throws Exception {
        Account account = api.register();
        api.login("  " + account.email().toUpperCase() + " ", account.password())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.username").value(account.username()));
    }

    @Test
    void wrongPasswordAndUnknownUserGiveTheSameAnswer() throws Exception {
        Account account = api.register();

        String wrong = api.login(account.username(), "Wrong#Pass12345")
                .andExpect(status().isUnauthorized())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.title").value("Credenziali non valide"))
                .andReturn().getResponse().getContentAsString();
        String unknown = api.login(TestApi.uniqueName(), "Wrong#Pass12345")
                .andExpect(status().isUnauthorized())
                .andReturn().getResponse().getContentAsString();

        assertThat(unknown).isEqualTo(wrong);
    }

    @Test
    void fiveFailuresLockTheAccountForOneMinute() throws Exception {
        Account account = api.register();
        for (int i = 0; i < 5; i++) {
            api.login(account.username(), "Wrong#Pass12345").andExpect(status().isUnauthorized());
        }

        api.login(account.username(), account.password())
                .andExpect(status().isLocked())
                .andExpect(header().string("Retry-After", org.hamcrest.Matchers.matchesPattern("[1-6]?[0-9]")))
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON));

        clock.advance(Duration.ofSeconds(61));
        api.login(account.username(), account.password()).andExpect(status().isOk());
        assertThat(users.findByEmail(account.email()).orElseThrow().getFailedLogins()).isZero();
    }

    @Test
    void lockGrowsToFiveMinutesAfterTheSixthFailure() throws Exception {
        Account account = api.register();
        for (int i = 0; i < 5; i++) {
            api.login(account.username(), "Wrong#Pass12345");
        }
        clock.advance(Duration.ofSeconds(61));
        api.login(account.username(), "Wrong#Pass12345").andExpect(status().isUnauthorized());

        clock.advance(Duration.ofSeconds(61));
        api.login(account.username(), account.password()).andExpect(status().isLocked());
        clock.advance(Duration.ofMinutes(4));
        api.login(account.username(), account.password()).andExpect(status().isOk());
    }

    @Test
    void meRequiresAValidAccessToken() throws Exception {
        Account account = api.register();
        TestApi.Session session = api.loginSession(account);

        mvc.perform(get("/api/me").header("Authorization", session.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value(account.username()));

        mvc.perform(get("/api/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON));
        mvc.perform(get("/api/me").header("Authorization", "Bearer not-a-jwt"))
                .andExpect(status().isUnauthorized())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON));
    }

    @Test
    void expiredAccessTokenIsRejected() throws Exception {
        TestApi.Session session = api.loginSession(api.register());
        clock.advance(Duration.ofMinutes(15).plusSeconds(1));

        mvc.perform(get("/api/me").header("Authorization", session.bearer()))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void tokenSignedWithAnotherKeyIsRejected() throws Exception {
        Account account = api.register();
        String sub = users.findByEmail(account.email()).orElseThrow().getId().toString();
        byte[] otherKey = "another-secret-that-is-at-least-32-bytes-long!!".getBytes(StandardCharsets.UTF_8);
        NimbusJwtEncoder encoder = NimbusJwtEncoder
                .withSecretKey(new SecretKeySpec(otherKey, "HmacSHA256")).build();
        Instant now = Instant.now();
        String forged = encoder.encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(),
                JwtClaimsSet.builder().issuer("nightcrawlers").subject(sub).issuedAt(now)
                        .expiresAt(now.plusSeconds(900)).claim("email_verified", true).build()))
                .getTokenValue();

        mvc.perform(get("/api/me").header("Authorization", "Bearer " + forged))
                .andExpect(status().isUnauthorized());
    }
}
