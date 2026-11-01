package com.nightcrawlers.auth;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.nightcrawlers.common.audit.AuditLogRepository;

/**
 * Daily retention job ({@code app.cleanup.cron}): deletes refresh and email tokens that can never
 * be accepted again, clears audit IP hashes older than {@code app.audit.ip-retention} and deletes
 * audit rows of deleted accounts older than {@code app.audit.retention}.
 */
@Service
public class TokenCleanupService {

    private static final Logger log = LoggerFactory.getLogger(TokenCleanupService.class);

    public record Result(int refreshTokens, int emailTokens, int auditIpHashesCleared, int auditRowsDeleted) {
    }

    private final RefreshTokenRepository refreshTokens;
    private final EmailTokenRepository emailTokens;
    private final AuditLogRepository auditLog;
    private final Clock clock;
    private final Duration ipRetention;
    private final Duration auditRetention;

    public TokenCleanupService(RefreshTokenRepository refreshTokens, EmailTokenRepository emailTokens,
            AuditLogRepository auditLog, Clock clock,
            @Value("${app.audit.ip-retention:P90D}") Duration ipRetention,
            @Value("${app.audit.retention:P365D}") Duration auditRetention) {
        this.refreshTokens = refreshTokens;
        this.emailTokens = emailTokens;
        this.auditLog = auditLog;
        this.clock = clock;
        this.ipRetention = ipRetention;
        this.auditRetention = auditRetention;
    }

    @Scheduled(cron = "${app.cleanup.cron:0 30 3 * * *}")
    @Transactional
    public Result purge() {
        Instant now = clock.instant();
        Result result = new Result(
                refreshTokens.deleteDeadFamilies(now),
                emailTokens.deleteUsedOrExpired(now),
                auditLog.clearIpHashesBefore(now.minus(ipRetention)),
                auditLog.deleteDetachedBefore(now.minus(auditRetention)));
        log.info("Retention cleanup: {} refresh tokens, {} email tokens deleted; {} audit IP hashes cleared, "
                + "{} audit rows deleted", result.refreshTokens(), result.emailTokens(),
                result.auditIpHashesCleared(), result.auditRowsDeleted());
        return result;
    }
}
