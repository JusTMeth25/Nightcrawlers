package com.nightcrawlers.auth;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.nightcrawlers.common.ApiException;
import com.nightcrawlers.common.AppProperties;
import com.nightcrawlers.common.SecureTokens;
import com.nightcrawlers.common.audit.AuditEvent;
import com.nightcrawlers.common.audit.AuditService;
import com.nightcrawlers.user.User;
import com.nightcrawlers.user.UserRepository;

import jakarta.servlet.http.HttpServletRequest;

/**
 * Refresh tokens: opaque, 256 bit, stored as SHA-256, single use. Presenting a token that was
 * already used means it was copied, and the whole family (one login) is revoked, except for a
 * quick retry within {@code app.refresh.reuse-grace} whose successor is still unused.
 */
@Service
public class RefreshTokenService {

    private static final Logger log = LoggerFactory.getLogger(RefreshTokenService.class);
    static final int USER_AGENT_MAX = 512;

    /** Plain token for the cookie and its expiry. */
    public record IssuedRefresh(String token, Instant expiresAt) {
        @Override
        public String toString() {
            return "IssuedRefresh[expiresAt=" + expiresAt + "]";
        }
    }

    public record Rotation(User user, IssuedRefresh next) {
    }

    private final RefreshTokenRepository tokens;
    private final UserRepository users;
    private final AuditService audit;
    private final Duration ttl;
    private final Duration absoluteTtl;
    private final Duration reuseGrace;
    private final Clock clock;

    public RefreshTokenService(RefreshTokenRepository tokens, UserRepository users, AuditService audit,
            AppProperties props, Clock clock) {
        this.tokens = tokens;
        this.users = users;
        this.audit = audit;
        this.ttl = props.refresh().ttl();
        this.absoluteTtl = props.refresh().absoluteTtl();
        this.reuseGrace = props.refresh().reuseGrace();
        this.clock = clock;
    }

    /** Issues a token in the given family, or in a new family when {@code familyIdOrNull} is null. */
    @Transactional
    public IssuedRefresh issue(User user, UUID familyIdOrNull, String userAgent) {
        return issueStored(user, familyIdOrNull, userAgent).issued();
    }

    private record Stored(UUID id, IssuedRefresh issued) {
    }

    private Stored issueStored(User user, UUID familyIdOrNull, String userAgent) {
        Instant now = clock.instant();
        String token = SecureTokens.newToken();
        UUID family = familyIdOrNull != null ? familyIdOrNull : UUID.randomUUID();
        Instant expiresAt = now.plus(ttl);
        if (familyIdOrNull != null) {
            // Rotation slides the expiry, but never past the absolute lifetime of the login.
            Instant start = tokens.familyStart(familyIdOrNull);
            if (start != null && start.plus(absoluteTtl).isBefore(expiresAt)) {
                expiresAt = start.plus(absoluteTtl);
            }
        }
        RefreshToken stored = tokens.save(new RefreshToken(user.getId(), family, SecureTokens.sha256Hex(token), now,
                expiresAt, truncate(userAgent)));
        return new Stored(stored.getId(), new IssuedRefresh(token, expiresAt));
    }

    /**
     * Consumes the presented token and issues its successor in the same family. The revocation
     * on reuse must survive the 401, hence {@code noRollbackFor}.
     */
    @Transactional(noRollbackFor = ApiException.class)
    public Rotation rotate(String presentedToken, String userAgent, HttpServletRequest http) {
        if (presentedToken == null || presentedToken.isBlank()) {
            throw invalid();
        }
        String hash = SecureTokens.sha256Hex(presentedToken);
        Instant now = clock.instant();
        if (tokens.markUsed(hash, now) == 1) {
            RefreshToken current = tokens.findByTokenHash(hash).orElseThrow(RefreshTokenService::invalid);
            return successorOf(current, userAgent);
        }
        Optional<RefreshToken> known = tokens.findByTokenHashForUpdate(hash);
        if (known.isPresent() && known.get().getUsedAt() != null) {
            RefreshToken reused = known.get();
            if (withinGrace(reused, now) && tokens.supersedeUnused(reused.getReplacedBy(), now) == 1) {
                log.info("Refresh token retried within the grace window, family {}", reused.getFamilyId());
                audit.record(AuditEvent.REFRESH_GRACE, reused.getUserId(), http);
                return successorOf(reused, userAgent);
            }
            log.warn("Refresh token reuse detected, revoking family {}", reused.getFamilyId());
            tokens.revokeFamily(reused.getFamilyId(), now);
            audit.record(AuditEvent.REFRESH_REUSE, reused.getUserId(), http);
        }
        throw invalid();
    }

    /** Issues the next token of the family and records it as the successor of {@code current}. */
    private Rotation successorOf(RefreshToken current, String userAgent) {
        User user = users.findById(current.getUserId()).orElseThrow(RefreshTokenService::invalid);
        Stored next = issueStored(user, current.getFamilyId(), userAgent);
        tokens.setReplacedBy(current.getId(), next.id());
        return new Rotation(user, next.issued());
    }

    /**
     * A used token presented again shortly after its rotation, in a family that is still valid, is
     * a lost response (reload or closed tab) rather than theft, provided its successor was never
     * used: the caller then supersedes that successor. Otherwise it is reuse.
     */
    private boolean withinGrace(RefreshToken reused, Instant now) {
        return reused.getRevokedAt() == null
                && reused.getReplacedBy() != null
                && Duration.between(reused.getUsedAt(), now).compareTo(reuseGrace) < 0;
    }

        /** Revokes the family of the presented token, if it is known. */
    @Transactional
    public Optional<UUID> revokeFamilyOf(String presentedToken) {
        if (presentedToken == null || presentedToken.isBlank()) {
            return Optional.empty();
        }
        return tokens.findByTokenHash(SecureTokens.sha256Hex(presentedToken)).map(t -> {
            revokeFamily(t.getFamilyId());
            return t.getUserId();
        });
    }

    @Transactional
    public void revokeFamily(UUID familyId) {
        tokens.revokeFamily(familyId, clock.instant());
    }

    @Transactional
    public void revokeAllForUser(UUID userId) {
        tokens.revokeAllForUser(userId, clock.instant());
    }

    static String truncate(String userAgent) {
        if (userAgent == null) {
            return null;
        }
        return userAgent.length() <= USER_AGENT_MAX ? userAgent : userAgent.substring(0, USER_AGENT_MAX);
    }

    private static ApiException invalid() {
        return new ApiException(HttpStatus.UNAUTHORIZED, "error.invalidSession");
    }
}
