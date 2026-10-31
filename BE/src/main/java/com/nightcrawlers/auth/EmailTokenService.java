package com.nightcrawlers.auth;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.nightcrawlers.common.ApiException;
import com.nightcrawlers.common.SecureTokens;
import com.nightcrawlers.user.User;
import com.nightcrawlers.user.UserRepository;

@Service
public class EmailTokenService {

    static final String INVALID_TITLE = "Token non valido o scaduto";

    private final EmailTokenRepository tokens;
    private final UserRepository users;
    private final Clock clock;

    public EmailTokenService(EmailTokenRepository tokens, UserRepository users, Clock clock) {
        this.tokens = tokens;
        this.users = users;
        this.clock = clock;
    }

    /** @return the plain token (32 random bytes, base64url) to put in the email link */
    @Transactional
    public String issue(User user, EmailToken.Purpose purpose, Duration ttl) {
        Instant now = clock.instant();
        tokens.invalidateOpen(user.getId(), purpose, now);
        String token = SecureTokens.newToken();
        tokens.save(new EmailToken(UUID.randomUUID(), user.getId(), purpose, SecureTokens.sha256Hex(token),
                now.plus(ttl)));
        return token;
    }

    /** Returns the user of a valid (unused, unexpired) token without consuming it. */
    @Transactional(readOnly = true)
    public User peek(String token, EmailToken.Purpose purpose) {
        if (token == null || token.isBlank()) {
            throw invalid();
        }
        EmailToken stored = tokens.findByTokenHashAndPurpose(SecureTokens.sha256Hex(token), purpose)
                .filter(t -> t.getUsedAt() == null && t.getExpiresAt().isAfter(clock.instant()))
                .orElseThrow(EmailTokenService::invalid);
        return users.findById(stored.getUserId()).orElseThrow(EmailTokenService::invalid);
    }

    /** Marks the token used and returns its user; 400 if unknown, used or expired. */
    @Transactional
    public User consume(String token, EmailToken.Purpose purpose) {
        if (token == null || token.isBlank()) {
            throw invalid();
        }
        EmailToken stored = tokens.findByTokenHashAndPurpose(SecureTokens.sha256Hex(token), purpose)
                .orElseThrow(EmailTokenService::invalid);
        if (tokens.markUsed(stored.getId(), clock.instant()) != 1) {
            throw invalid();
        }
        return users.findById(stored.getUserId()).orElseThrow(EmailTokenService::invalid);
    }

    private static ApiException invalid() {
        return new ApiException(HttpStatus.BAD_REQUEST, INVALID_TITLE,
                "Il link non è valido, è già stato usato o è scaduto.");
    }
}
