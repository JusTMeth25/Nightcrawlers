package com.nightcrawlers.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtException;

import com.nightcrawlers.common.AppProperties;
import com.nightcrawlers.user.User;

class JwtServiceTest {

    static final String SECRET = "unit-test-secret-of-at-least-thirty-two-bytes";
    final Instant now = Instant.parse("2026-10-31T10:00:00Z");

    static AppProperties props(String secret) {
        return new AppProperties(new AppProperties.Jwt(secret, Duration.ofMinutes(15)),
                new AppProperties.Refresh(Duration.ofDays(30)), new AppProperties.Cors(List.of("http://x")),
                new AppProperties.Mail("a@b.c"), "http://x", "salt", new AppProperties.Cookies(true));
    }

    JwtService at(Instant instant, String secret) {
        return new JwtService(props(secret), Clock.fixed(instant, ZoneOffset.UTC));
    }

    @Test
    void accessTokenCarriesSubjectVerificationAndFifteenMinuteExpiry() {
        User user = new User("mario", "mario@mail.it", "h", now);
        user.setEmailVerified(true);
        JwtService jwt = at(now, SECRET);

        Jwt decoded = jwt.decoder().decode(jwt.issueAccess(user));

        assertThat(decoded.getSubject()).isEqualTo(user.getId().toString());
        assertThat(decoded.getClaimAsBoolean("email_verified")).isTrue();
        assertThat(decoded.getIssuedAt()).isEqualTo(now);
        assertThat(decoded.getExpiresAt()).isEqualTo(now.plusSeconds(900));
        assertThat(decoded.getHeaders()).containsEntry("alg", "HS256");
        assertThat(jwt.accessTtlSeconds()).isEqualTo(900);
    }

    @Test
    void expiredTokenAndForeignSignatureAreRejected() {
        User user = new User("mario", "mario@mail.it", "h", now);
        String token = at(now, SECRET).issueAccess(user);

        assertThatThrownBy(() -> at(now.plusSeconds(901), SECRET).decoder().decode(token))
                .isInstanceOf(JwtException.class);
        assertThatThrownBy(() -> at(now, SECRET + "-other").decoder().decode(token))
                .isInstanceOf(JwtException.class);
    }

    @Test
    void shortSecretIsRefused() {
        assertThatThrownBy(() -> at(now, "too-short")).isInstanceOf(IllegalStateException.class);
    }
}
