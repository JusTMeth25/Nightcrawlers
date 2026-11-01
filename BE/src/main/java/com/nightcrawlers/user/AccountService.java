package com.nightcrawlers.user;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.nightcrawlers.auth.AuthService;
import com.nightcrawlers.auth.RefreshTokenRepository;
import com.nightcrawlers.common.ApiException;
import com.nightcrawlers.common.audit.AuditEvent;
import com.nightcrawlers.common.audit.AuditLog;
import com.nightcrawlers.common.audit.AuditLogRepository;
import com.nightcrawlers.common.audit.AuditService;
import com.nightcrawlers.run.RunCheckpoint;
import com.nightcrawlers.run.RunCheckpointRepository;
import com.nightcrawlers.run.RunRecord;
import com.nightcrawlers.run.RunRecordRepository;
import com.nightcrawlers.save.SaveService;
import com.nightcrawlers.user.AccountExport.AuditExport;
import com.nightcrawlers.user.AccountExport.CheckpointExport;
import com.nightcrawlers.user.AccountExport.RunExport;
import com.nightcrawlers.user.AccountExport.SessionExport;

import jakarta.servlet.http.HttpServletRequest;

/** Profile, GDPR export and account deletion. */
@Service
public class AccountService {

    private final UserRepository users;
    private final SaveService saves;
    private final RunRecordRepository runs;
    private final RunCheckpointRepository checkpoints;
    private final RefreshTokenRepository refreshTokens;
    private final AuditLogRepository auditLog;
    private final AuditService audit;
    private final PasswordEncoder passwordEncoder;
    private final Clock clock;

    public AccountService(UserRepository users, SaveService saves, RunRecordRepository runs,
            RunCheckpointRepository checkpoints, RefreshTokenRepository refreshTokens, AuditLogRepository auditLog,
            AuditService audit, PasswordEncoder passwordEncoder, Clock clock) {
        this.users = users;
        this.saves = saves;
        this.runs = runs;
        this.checkpoints = checkpoints;
        this.refreshTokens = refreshTokens;
        this.auditLog = auditLog;
        this.audit = audit;
        this.passwordEncoder = passwordEncoder;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public UserDto profile(UUID userId) {
        return UserDto.from(user(userId));
    }

    @Transactional(readOnly = true)
    public AccountExport export(UUID userId) {
        Instant now = clock.instant();
        User user = user(userId);
        List<RunRecord> userRuns = runs.findByUserId(userId).stream()
                .sorted(Comparator.comparing(RunRecord::getStartedAt))
                .toList();
        Map<UUID, List<CheckpointExport>> checkpointsByRun = userRuns.isEmpty() ? Map.of()
                : checkpoints.findByRunIdInOrderByIdAsc(userRuns.stream().map(RunRecord::getId).toList()).stream()
                        .collect(Collectors.groupingBy(RunCheckpoint::getRunId,
                                Collectors.mapping(AccountService::checkpoint, Collectors.toList())));
        List<RunExport> runExports = userRuns.stream()
                .map(r -> new RunExport(r.getId(), r.getCharacterId(), r.getSeed(), r.getStatus().name(),
                        r.getStartedAt(), r.getEndedAt(), r.getLastCheckpointAt(), r.getDurationSec(), r.getKills(),
                        r.getLevel(), r.getEurodollarsAwarded(), r.getFlagReason(),
                        checkpointsByRun.getOrDefault(r.getId(), List.of())))
                .toList();
        List<SessionExport> sessions = refreshTokens.findByUserId(userId).stream()
                .filter(t -> t.getUsedAt() == null && t.getRevokedAt() == null && t.getExpiresAt().isAfter(now))
                .sorted(Comparator.comparing(t -> t.getCreatedAt()))
                .map(t -> new SessionExport(t.getCreatedAt(), t.getExpiresAt(), t.getUserAgent()))
                .toList();
        List<AuditExport> events = auditLog.findByUserId(userId).stream()
                .sorted(Comparator.comparing(AuditLog::getId))
                .map(a -> new AuditExport(a.getEvent().name(), a.getCreatedAt()))
                .toList();
        return new AccountExport(now, UserDto.from(user), saves.load(userId), runExports, sessions, events);
    }

    /**
     * Deletes the account after checking its password. A wrong password is 403, not 401: the
     * client reserves 401 for an expired session; a locked account is 423 with Retry-After. Every row of the user goes with it (ON DELETE
     * CASCADE); audit rows stay with {@code user_id} set to null.
     */
    @Transactional(noRollbackFor = ApiException.class)
    public void delete(UUID userId, String password, HttpServletRequest http) {
        Instant now = clock.instant();
        User user = user(userId);
        AuthService.requireNotLocked(user, now);
        if (!passwordEncoder.matches(password, user.getPasswordHash())) {
            registerWrongPassword(userId, now, http);
            throw new ApiException(HttpStatus.FORBIDDEN, "Password errata", "La password non è corretta.");
        }
        users.delete(user);
        users.flush();
        audit.record(AuditEvent.ACCOUNT_DELETED, null, http);
    }

    /**
     * Wrong passwords share the login failure counter and its progressive lock, so a stolen
     * access token cannot be used to guess the password. Reaching a lock also ends every session.
     * The transaction keeps these writes although the request ends with 403.
     */
    private void registerWrongPassword(UUID userId, Instant now, HttpServletRequest http) {
        int failures = users.incrementFailedLogins(userId);
        Duration lock = AuthService.lockDuration(failures);
        if (lock != null) {
            users.lockUntil(userId, now.plus(lock));
            refreshTokens.revokeAllForUser(userId, now);
            audit.record(AuditEvent.ACCOUNT_LOCKED, userId, http);
        }
    }

    private User user(UUID userId) {
        return users.findById(userId).orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Non autenticato",
                "Accesso richiesto o sessione scaduta."));
    }

    private static CheckpointExport checkpoint(RunCheckpoint c) {
        return new CheckpointExport(c.getAt(), c.getElapsedSec(), c.getKills(), c.getLevel(), c.getEurodollars());
    }
}
