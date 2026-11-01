package com.nightcrawlers.auth;

import java.time.Clock;
import java.time.Instant;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Removes refresh and email tokens that can never be accepted again (schedule: {@code app.cleanup.cron}). */
@Service
public class TokenCleanupService {

    private static final Logger log = LoggerFactory.getLogger(TokenCleanupService.class);

    public record Result(int refreshTokens, int emailTokens) {
    }

    private final RefreshTokenRepository refreshTokens;
    private final EmailTokenRepository emailTokens;
    private final Clock clock;

    public TokenCleanupService(RefreshTokenRepository refreshTokens, EmailTokenRepository emailTokens, Clock clock) {
        this.refreshTokens = refreshTokens;
        this.emailTokens = emailTokens;
        this.clock = clock;
    }

    @Scheduled(cron = "${app.cleanup.cron:0 30 3 * * *}")
    @Transactional
    public Result purge() {
        Instant now = clock.instant();
        Result result = new Result(refreshTokens.deleteDeadFamilies(now), emailTokens.deleteUsedOrExpired(now));
        log.info("Token cleanup: {} refresh tokens, {} email tokens deleted", result.refreshTokens(),
                result.emailTokens());
        return result;
    }
}
