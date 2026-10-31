package com.nightcrawlers.auth;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.nightcrawlers.common.AppProperties;
import com.nightcrawlers.common.SecureTokens;
import com.nightcrawlers.user.User;

@Service
public class RefreshTokenService {

    static final int USER_AGENT_MAX = 512;

    /** Plain token for the cookie and its expiry. */
    public record IssuedRefresh(String token, Instant expiresAt) {
        @Override
        public String toString() {
            return "IssuedRefresh[expiresAt=" + expiresAt + "]";
        }
    }

    private final RefreshTokenRepository tokens;
    private final Duration ttl;
    private final Clock clock;

    public RefreshTokenService(RefreshTokenRepository tokens, AppProperties props, Clock clock) {
        this.tokens = tokens;
        this.ttl = props.refresh().ttl();
        this.clock = clock;
    }

    /** Issues a token in the given family, or in a new family when {@code familyIdOrNull} is null. */
    @Transactional
    public IssuedRefresh issue(User user, UUID familyIdOrNull, String userAgent) {
        Instant now = clock.instant();
        String token = SecureTokens.newToken();
        UUID family = familyIdOrNull != null ? familyIdOrNull : UUID.randomUUID();
        Instant expiresAt = now.plus(ttl);
        tokens.save(new RefreshToken(user.getId(), family, SecureTokens.sha256Hex(token), now, expiresAt,
                truncate(userAgent)));
        return new IssuedRefresh(token, expiresAt);
    }

    static String truncate(String userAgent) {
        if (userAgent == null) {
            return null;
        }
        return userAgent.length() <= USER_AGENT_MAX ? userAgent : userAgent.substring(0, USER_AGENT_MAX);
    }
}
