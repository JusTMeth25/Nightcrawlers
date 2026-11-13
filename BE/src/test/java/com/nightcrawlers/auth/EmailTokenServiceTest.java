package com.nightcrawlers.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpStatus;

import com.nightcrawlers.common.ApiException;
import com.nightcrawlers.common.SecureTokens;
import com.nightcrawlers.user.User;
import com.nightcrawlers.user.UserRepository;

class EmailTokenServiceTest {

    final Instant now = Instant.parse("2026-10-31T10:00:00Z");
    final EmailTokenRepository tokens = mock(EmailTokenRepository.class);
    final UserRepository users = mock(UserRepository.class);
    final EmailTokenService service = new EmailTokenService(tokens, users, Clock.fixed(now, ZoneOffset.UTC));
    final User user = new User("mario", "mario@mail.it", "hash", now);

    @Test
    void issueStoresOnlyTheHashOfA256BitToken() {
        String token = service.issue(user, EmailToken.Purpose.VERIFY, Duration.ofMinutes(30));

        assertThat(token).matches("[A-Za-z0-9_-]{43}");
        ArgumentCaptor<EmailToken> captor = ArgumentCaptor.forClass(EmailToken.class);
        verify(tokens).save(captor.capture());
        EmailToken saved = captor.getValue();
        assertThat(saved.getTokenHash()).isEqualTo(SecureTokens.sha256Hex(token)).isNotEqualTo(token);
        assertThat(saved.getExpiresAt()).isEqualTo(now.plus(Duration.ofMinutes(30)));
        assertThat(saved.getPurpose()).isEqualTo(EmailToken.Purpose.VERIFY);
        assertThat(saved.getUserId()).isEqualTo(user.getId());
        verify(tokens).invalidateOpen(user.getId(), EmailToken.Purpose.VERIFY, now);
    }

    @Test
    void consumeReturnsTheUserWhenTheTokenIsMarkedUsed() {
        String token = "abc";
        UUID tokenId = UUID.randomUUID();
        EmailToken stored = new EmailToken(tokenId, user.getId(), EmailToken.Purpose.RESET, SecureTokens.sha256Hex(token),
                now.plusSeconds(60));
        when(tokens.findByTokenHashAndPurpose(SecureTokens.sha256Hex(token), EmailToken.Purpose.RESET))
                .thenReturn(Optional.of(stored));
        when(tokens.markUsed(eq(tokenId), any())).thenReturn(1);
        when(users.findById(user.getId())).thenReturn(Optional.of(user));

        assertThat(service.consume(token, EmailToken.Purpose.RESET)).isSameAs(user);
    }

    @Test
    void consumeRejectsUnknownUsedOrExpiredTokens() {
        when(tokens.findByTokenHashAndPurpose(any(), any())).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.consume("nope", EmailToken.Purpose.VERIFY))
                .isInstanceOfSatisfying(ApiException.class, e -> {
                    assertThat(e.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
                    assertThat(e.getCode()).isEqualTo("error.invalidToken");
                });

        EmailToken stored = new EmailToken(UUID.randomUUID(), user.getId(), EmailToken.Purpose.VERIFY,
                SecureTokens.sha256Hex("used"), now.plusSeconds(60));
        when(tokens.findByTokenHashAndPurpose(eq(SecureTokens.sha256Hex("used")), any())).thenReturn(Optional.of(stored));
        when(tokens.markUsed(any(), any())).thenReturn(0);
        assertThatThrownBy(() -> service.consume("used", EmailToken.Purpose.VERIFY)).isInstanceOf(ApiException.class);

        assertThatThrownBy(() -> service.consume(null, EmailToken.Purpose.VERIFY)).isInstanceOf(ApiException.class);
    }
}
