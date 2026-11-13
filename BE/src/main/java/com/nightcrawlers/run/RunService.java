package com.nightcrawlers.run;

import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.nightcrawlers.common.ApiException;
import com.nightcrawlers.common.audit.AuditEvent;
import com.nightcrawlers.common.audit.AuditService;
import com.nightcrawlers.gamedata.GameData;
import com.nightcrawlers.run.AntiCheatService.Verdict;
import com.nightcrawlers.run.UnlockEvaluator.Progress;
import com.nightcrawlers.run.dto.BestRunDto;
import com.nightcrawlers.run.dto.CheckpointRequest;
import com.nightcrawlers.run.dto.EndRunRequest;
import com.nightcrawlers.run.dto.EndRunResponse;
import com.nightcrawlers.run.dto.StartRunResponse;
import com.nightcrawlers.save.CharacterStat;
import com.nightcrawlers.save.CharacterStatRepository;
import com.nightcrawlers.save.CodexEntry;
import com.nightcrawlers.save.CodexEntryRepository;
import com.nightcrawlers.save.EnemyKillStat;
import com.nightcrawlers.save.EnemyKillStatRepository;
import com.nightcrawlers.save.PlayerSave;
import com.nightcrawlers.save.PlayerSaveRepository;
import com.nightcrawlers.save.RipperdocUpgrade;
import com.nightcrawlers.save.RipperdocUpgradeRepository;
import com.nightcrawlers.save.SaveService;
import com.nightcrawlers.save.UnlockedCharacter;
import com.nightcrawlers.save.UnlockedCharacterRepository;
import com.nightcrawlers.user.User;
import com.nightcrawlers.user.UserRepository;

import jakarta.servlet.http.HttpServletRequest;

/**
 * Run lifecycle (spec 4.6). The server owns seed, start time and reward; the client's numbers
 * are only checked for plausibility. Locks: the user row serializes starts, the run row
 * serializes checkpoint/end of one run, the save row serializes rewards with purchases.
 */
@Service
public class RunService {

    private static final Logger log = LoggerFactory.getLogger(RunService.class);
    static final String GREED = "greed";
    static final int BEST_LIMIT = 10;
    static final String EVOLUTION_SUFFIX = "_evo";

    private final RunRecordRepository runs;
    private final RunCheckpointRepository checkpoints;
    private final UserRepository users;
    private final PlayerSaveRepository saves;
    private final UnlockedCharacterRepository unlocked;
    private final RipperdocUpgradeRepository upgrades;
    private final EnemyKillStatRepository killStats;
    private final CharacterStatRepository characterStats;
    private final CodexEntryRepository codex;
    private final SaveService saveService;
    private final AntiCheatService antiCheat;
    private final RewardCalculator rewards;
    private final UnlockEvaluator unlockEvaluator;
    private final AuditService audit;
    private final GameData gameData;
    private final SecureRandom random = new SecureRandom();

    public RunService(RunRecordRepository runs, RunCheckpointRepository checkpoints, UserRepository users,
            PlayerSaveRepository saves, UnlockedCharacterRepository unlocked, RipperdocUpgradeRepository upgrades,
            EnemyKillStatRepository killStats, CharacterStatRepository characterStats, CodexEntryRepository codex,
            SaveService saveService, AntiCheatService antiCheat, RewardCalculator rewards,
            UnlockEvaluator unlockEvaluator, AuditService audit, GameData gameData) {
        this.runs = runs;
        this.checkpoints = checkpoints;
        this.users = users;
        this.saves = saves;
        this.unlocked = unlocked;
        this.upgrades = upgrades;
        this.killStats = killStats;
        this.characterStats = characterStats;
        this.codex = codex;
        this.saveService = saveService;
        this.antiCheat = antiCheat;
        this.rewards = rewards;
        this.unlockEvaluator = unlockEvaluator;
        this.audit = audit;
        this.gameData = gameData;
    }

    /** Starts a run; the user's previous {@code ACTIVE} run, if any, becomes {@code ABANDONED}. */
    @Transactional
    public StartRunResponse start(UUID userId, String characterId, Instant now) {
        if (!gameData.isCharacter(characterId)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "error.invalidData")
                    .withError("characterId", "field.unknownCharacter");
        }
        User user = users.findByIdForUpdate(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "error.notAuthenticated"));
        if (!user.isEmailVerified()) {
            throw new ApiException(HttpStatus.FORBIDDEN, "error.emailNotVerifiedRuns");
        }
        if (!unlocked.existsById(new UnlockedCharacter.Key(userId, characterId))) {
            throw new ApiException(HttpStatus.FORBIDDEN, "error.characterLocked");
        }
        Instant startedAt = now.truncatedTo(ChronoUnit.MICROS); // PostgreSQL precision
        runs.abandonActive(userId, startedAt);
        RunRecord run = runs.saveAndFlush(
                new RunRecord(userId, characterId, random.nextInt(Integer.MAX_VALUE), startedAt));
        return new StartRunResponse(run.getId(), run.getSeed(), run.getStartedAt());
    }

    /**
     * Stores a plausible checkpoint. Checkpoints closer than half a period in real time, or beyond
     * the per-run cap, answer 429 without any change. An implausible one answers 422 and marks the run, which
     * is then flagged at its end; the mark must survive the error, hence {@code noRollbackFor}.
     */
    @Transactional(noRollbackFor = ApiException.class)
    public void checkpoint(UUID userId, UUID runId, CheckpointRequest request, Instant now) {
        RunRecord run = activeRun(userId, runId);
        Optional<RunCheckpoint> previous = checkpoints.findFirstByRunIdOrderByIdDesc(runId);
        long wait = antiCheat.checkpointWaitSeconds(run, previous, now);
        if (wait > 0 || checkpoints.countByRunId(runId) >= antiCheat.maxCheckpoints(run, now)) {
            // Flood protection only: nothing is stored and the run is not flagged.
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "error.checkpointTooFrequent")
                    .withHeader(HttpHeaders.RETRY_AFTER, Long.toString(Math.max(wait, 1)));
        }
        Verdict verdict = antiCheat.checkCheckpoint(run, previous, request, now);
        if (verdict.flagged()) {
            if (run.getFlagReason() == null) {
                run.setFlagReason(verdict.reason());
            }
            log.info("Implausible checkpoint for run {}: {}", runId, verdict.reason());
            throw new ApiException(HttpStatus.UNPROCESSABLE_CONTENT, "error.checkpointImplausible");
        }
        checkpoints.save(new RunCheckpoint(runId, now, request.elapsedSec(), request.kills(), request.level(),
                request.eurodollars()));
        run.setLastCheckpointAt(now);
    }

    /**
     * Ends the run in one transaction: verdict, reward, save, statistics, Codex and unlocks.
     * Idempotent for a lost response: an ENDED or FLAGGED run answers its stored outcome with the
     * current save; an ABANDONED run is a conflict.
     */
    @Transactional
    public EndRunResponse end(UUID userId, UUID runId, EndRunRequest request, Instant now,
            HttpServletRequest http) {
        RunRecord run = runs.findOwnedForUpdate(runId, userId).orElseThrow(RunService::notFound);
        switch (run.getStatus()) {
            case ENDED -> {
                return new EndRunResponse(run.getEurodollarsAwarded(), splitIds(run.getNewUnlocks()), false,
                        saveService.load(userId));
            }
            case FLAGGED -> {
                return new EndRunResponse(0, List.of(), true, saveService.load(userId));
            }
            case ABANDONED -> throw notActive();
            case ACTIVE -> {
                // continue below
            }
        }
        Verdict verdict = run.getFlagReason() != null
                ? new Verdict(true, run.getFlagReason())
                : antiCheat.checkEnd(run, checkpoints.findFirstByRunIdOrderByIdDesc(runId), request, now);
        int durationSec = wholeSeconds(request.durationSec());
        run.setEndedAt(now);
        run.setDurationSec(durationSec);
        run.setKills(request.kills());
        run.setLevel(request.level());

        if (verdict.flagged()) {
            run.setStatus(RunRecord.Status.FLAGGED);
            run.setFlagReason(verdict.reason());
            run.setEurodollarsAwarded(0);
            audit.record(AuditEvent.RUN_FLAGGED, userId, http);
            log.info("Run {} flagged: {}", runId, verdict.reason());
            return new EndRunResponse(0, List.of(), true, saveService.load(userId));
        }

        PlayerSave save = saves.findForUpdate(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "error.saveNotFound"));
        int greed = upgrades.findById(new RipperdocUpgrade.Key(userId, GREED)).map(RipperdocUpgrade::getRank)
                .orElse(0);
        long award = rewards.compute(durationSec, request.kills(), greed);
        save.setEurodollars(Math.addExact(save.getEurodollars(), award));
        save.setTotalEurodollarsEarned(Math.addExact(save.getTotalEurodollarsEarned(), award));
        save.setTotalKills(Math.addExact(save.getTotalKills(), request.kills()));
        save.setBestTimeSec(Math.max(save.getBestTimeSec(), durationSec));

        CharacterStat stat = characterStats.findById(new CharacterStat.Key(userId, run.getCharacterId()))
                .orElseGet(() -> new CharacterStat(userId, run.getCharacterId(), 0, 0));
        stat.setRuns(stat.getRuns() + 1);
        stat.setBestTimeSec(Math.max(stat.getBestTimeSec(), durationSec));
        characterStats.save(stat);

        addKills(userId, request.killsByEnemy());
        addToCodex(userId, request, now);

        run.setStatus(RunRecord.Status.ENDED);
        run.setEurodollarsAwarded(award);
        List<String> newUnlocks = unlock(userId, save, now);
        run.setNewUnlocks(newUnlocks.isEmpty() ? null : String.join(",", newUnlocks));
        return new EndRunResponse(award, newUnlocks, false, saveService.load(userId));
    }

    @Transactional(readOnly = true)
    public List<BestRunDto> best(UUID userId) {
        return runs.findBest(userId, PageRequest.of(0, BEST_LIMIT)).stream()
                .map(r -> new BestRunDto(r.getId(), r.getCharacterId(), r.getDurationSec(), r.getKills(),
                        r.getLevel(), r.getEndedAt()))
                .toList();
    }

    private RunRecord activeRun(UUID userId, UUID runId) {
        RunRecord run = runs.findOwnedForUpdate(runId, userId).orElseThrow(RunService::notFound);
        if (run.getStatus() != RunRecord.Status.ACTIVE) {
            throw notActive();
        }
        return run;
    }

    private static ApiException notActive() {
        return new ApiException(HttpStatus.CONFLICT, "error.runNotActive");
    }

    private static List<String> splitIds(String ids) {
        return ids == null || ids.isEmpty() ? List.of() : List.of(ids.split(","));
    }

    static ApiException notFound() {
        return new ApiException(HttpStatus.NOT_FOUND, "error.runNotFound");
    }

    private void addKills(UUID userId, Map<String, Long> killsByEnemy) {
        killsByEnemy.forEach((enemyId, count) -> {
            if (count > 0) {
                EnemyKillStat stat = killStats.findById(new EnemyKillStat.Key(userId, enemyId))
                        .orElseGet(() -> new EnemyKillStat(userId, enemyId, 0));
                stat.setCount(Math.addExact(stat.getCount(), count));
                killStats.save(stat);
            }
        });
    }

    private void addToCodex(UUID userId, EndRunRequest request, Instant now) {
        Set<CodexEntry.Key> known = codex.findByUserId(userId).stream()
                .map(e -> new CodexEntry.Key(e.getUserId(), e.getEntryType(), e.getEntryId()))
                .collect(Collectors.toSet());
        Set<String> enemies = new LinkedHashSet<>(request.enemiesSeen());
        request.killsByEnemy().forEach((enemyId, count) -> {
            if (count > 0) {
                enemies.add(enemyId);
            }
        });
        enemies.forEach(id -> addEntry(known, userId, CodexEntry.Type.ENEMY, id, now));
        request.weaponsSeen().stream().map(id -> codexWeaponId(gameData, id)).distinct()
                .forEach(id -> addEntry(known, userId, CodexEntry.Type.WEAPON, id, now));
    }

    private void addEntry(Set<CodexEntry.Key> known, UUID userId, CodexEntry.Type type, String id, Instant now) {
        if (known.add(new CodexEntry.Key(userId, type, id))) {
            codex.save(new CodexEntry(userId, type, id, now));
        }
    }

    private List<String> unlock(UUID userId, PlayerSave save, Instant now) {
        Map<String, Long> kills = new HashMap<>();
        killStats.findByUserId(userId).forEach(k -> kills.put(k.getEnemyId(), k.getCount()));
        Map<String, Integer> bestTimes = new HashMap<>();
        characterStats.findByUserId(userId).forEach(c -> bestTimes.put(c.getCharacterId(), c.getBestTimeSec()));
        Set<String> already = unlocked.findByUserId(userId).stream().map(UnlockedCharacter::getCharacterId)
                .collect(Collectors.toSet());
        Progress progress = new Progress(save.getBestTimeSec(), kills, save.getTotalEurodollarsEarned(), bestTimes);
        List<String> fresh = unlockEvaluator.newUnlocks(progress, already);
        fresh.forEach(characterId -> unlocked.save(new UnlockedCharacter(userId, characterId, now)));
        return fresh;
    }

    /** The Codex lists base weapons (contract {@code WeaponId}): an evolution counts as its base. */
    static String codexWeaponId(GameData gameData, String weaponId) {
        if (weaponId.endsWith(EVOLUTION_SUFFIX)) {
            String base = weaponId.substring(0, weaponId.length() - EVOLUTION_SUFFIX.length());
            if (gameData.isWeapon(base)) {
                return base;
            }
        }
        return weaponId;
    }

    /** Whole seconds of game time, floored; validation already rejects negative values. */
    static int wholeSeconds(double seconds) {
        if (!Double.isFinite(seconds) || seconds <= 0) {
            return 0;
        }
        return (int) Math.min(Integer.MAX_VALUE, Math.floor(seconds));
    }
}
