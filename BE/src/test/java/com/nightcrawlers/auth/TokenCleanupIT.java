package com.nightcrawlers.auth;

import static org.assertj.core.api.Assertions.assertThat;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

import com.nightcrawlers.support.CapturingMailService;
import com.nightcrawlers.support.IntegrationTest;
import com.nightcrawlers.support.MutableClock;
import com.nightcrawlers.support.TestApi;
import com.nightcrawlers.user.UserRepository;

@IntegrationTest
class TokenCleanupIT {

    @Autowired
    MockMvc mvc;
    @Autowired
    CapturingMailService mail;
    @Autowired
    MutableClock clock;
    @Autowired
    UserRepository users;
    @Autowired
    JdbcTemplate jdbc;
    @Autowired
    TokenCleanupService cleanup;

    UUID userId;
    Instant now;

    @BeforeEach
    void setUp() throws Exception {
        clock.reset();
        TestApi api = new TestApi(mvc, mail);
        TestApi.Account account = api.register();
        userId = users.findByEmail(account.email()).orElseThrow().getId();
        jdbc.update("DELETE FROM refresh_tokens WHERE user_id = ?", userId);
        jdbc.update("DELETE FROM email_tokens WHERE user_id = ?", userId);
        now = clock.instant();
    }

    private String refresh(UUID family, Instant expiresAt, Instant usedAt, Instant revokedAt) {
        String hash = UUID.randomUUID().toString().replace("-", "") + "00000000000000000000000000000000";
        jdbc.update("""
                INSERT INTO refresh_tokens (id, user_id, family_id, token_hash, expires_at, used_at, revoked_at,
                    created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                UUID.randomUUID(), userId, family, hash, ts(expiresAt), ts(usedAt), ts(revokedAt),
                ts(now.minusSeconds(86_400)));
        return hash;
    }

    private String email(Instant expiresAt, Instant usedAt) {
        String hash = UUID.randomUUID().toString().replace("-", "") + "11111111111111111111111111111111";
        jdbc.update("""
                INSERT INTO email_tokens (id, user_id, purpose, token_hash, expires_at, used_at)
                VALUES (?, ?, 'VERIFY', ?, ?, ?)""", UUID.randomUUID(), userId, hash, ts(expiresAt), ts(usedAt));
        return hash;
    }

    private static Timestamp ts(Instant instant) {
        return instant == null ? null : Timestamp.from(instant);
    }

    private List<String> remaining(String table) {
        return jdbc.queryForList("SELECT token_hash FROM " + table + " WHERE user_id = ?", String.class, userId);
    }

    @Test
    void deadRefreshFamiliesAreDeletedLiveOnesKeptWhole() {
        UUID live = UUID.randomUUID();
        String usedInLiveFamily = refresh(live, now.plusSeconds(3600), now.minusSeconds(60), null);
        String current = refresh(live, now.plusSeconds(86_400), null, null);
        String expired = refresh(UUID.randomUUID(), now.minusSeconds(1), null, null);
        UUID revoked = UUID.randomUUID();
        String revokedOld = refresh(revoked, now.plusSeconds(3600), now.minusSeconds(60), now.minusSeconds(30));
        String revokedNew = refresh(revoked, now.plusSeconds(86_400), null, now.minusSeconds(30));

        TokenCleanupService.Result result = cleanup.purge();

        // the used token of a live family stays: presenting it again must still revoke the family
        assertThat(remaining("refresh_tokens")).containsExactlyInAnyOrder(usedInLiveFamily, current)
                .doesNotContain(expired, revokedOld, revokedNew);
        assertThat(result.refreshTokens()).isGreaterThanOrEqualTo(3);
    }

    @Test
    void usedAndExpiredEmailTokensAreDeleted() {
        String open = email(now.plusSeconds(600), null);
        String used = email(now.plusSeconds(600), now.minusSeconds(5));
        String expired = email(now.minusSeconds(1), null);

        TokenCleanupService.Result result = cleanup.purge();

        assertThat(remaining("email_tokens")).containsExactly(open).doesNotContain(used, expired);
        assertThat(result.emailTokens()).isGreaterThanOrEqualTo(2);
    }

    private long audit(UUID user, long daysAgo) {
        return jdbc.queryForObject("""
                INSERT INTO audit_log (user_id, event, ip_hash, created_at) VALUES (?, 'LOGIN_SUCCESS', ?, ?)
                RETURNING id""", Long.class, user, "a".repeat(64), ts(now.minus(java.time.Duration.ofDays(daysAgo))));
    }

    private String ipHash(long id) {
        return jdbc.queryForObject("SELECT ip_hash FROM audit_log WHERE id = ?", String.class, id);
    }

    private boolean exists(long id) {
        return jdbc.queryForObject("SELECT count(*) FROM audit_log WHERE id = ?", Integer.class, id) == 1;
    }

    @Test
    void auditIpHashesExpireAfter90DaysAndDetachedRowsAfterAYear() {
        long recent = audit(userId, 10);
        long old = audit(userId, 91);
        long veryOldOwned = audit(userId, 400);
        long detachedOld = audit(null, 200);
        long detachedVeryOld = audit(null, 366);

        TokenCleanupService.Result result = cleanup.purge();

        assertThat(ipHash(recent)).isNotNull();
        assertThat(ipHash(old)).isNull();
        assertThat(exists(old)).isTrue();
        assertThat(exists(veryOldOwned)).isTrue();
        assertThat(ipHash(veryOldOwned)).isNull();
        assertThat(exists(detachedOld)).isTrue();
        assertThat(ipHash(detachedOld)).isNull();
        assertThat(exists(detachedVeryOld)).isFalse();
        assertThat(result.auditIpHashesCleared()).isGreaterThanOrEqualTo(3);
        assertThat(result.auditRowsDeleted()).isGreaterThanOrEqualTo(1);
    }
}
