package com.nightcrawlers.user;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import com.nightcrawlers.save.SaveDto;

/**
 * GDPR export of everything stored about one account. Secrets are left out on purpose: no
 * password hash, no refresh or email token (not even hashed), no IP hash.
 */
public record AccountExport(
        Instant exportedAt,
        UserDto profile,
        SaveDto save,
        List<RunExport> runs,
        List<SessionExport> sessions,
        List<AuditExport> auditLog) {

    public record RunExport(UUID id, String characterId, int seed, String status, Instant startedAt,
            Instant endedAt, Instant lastCheckpointAt, Integer durationSec, Long kills, Integer level,
            long eurodollarsAwarded, String flagReason, List<CheckpointExport> checkpoints) {
    }

    public record CheckpointExport(Instant at, double elapsedSec, long kills, int level, long eurodollars) {
    }

    /** An active login (refresh token family member that can still be used). */
    public record SessionExport(Instant createdAt, Instant expiresAt, String userAgent) {
    }

    public record AuditExport(String event, Instant createdAt) {
    }
}
