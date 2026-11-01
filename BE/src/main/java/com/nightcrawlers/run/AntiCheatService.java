package com.nightcrawlers.run;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.function.Predicate;
import java.util.function.Supplier;

import org.springframework.stereotype.Service;

import com.nightcrawlers.gamedata.GameData;
import com.nightcrawlers.gamedata.model.AntiCheat;
import com.nightcrawlers.run.dto.CheckpointRequest;
import com.nightcrawlers.run.dto.EndRunRequest;

/**
 * Plausibility of client-reported progress (spec 4.6, balance.json {@code antiCheat}). Each
 * interval is measured from the previous accepted checkpoint, or from the start of the run
 * (0 s, 0 kills, level 1, 0 €$). Rates use game time: it can never exceed real time + skew.
 */
@Service
public class AntiCheatService {

    /** {@code OK}, or flagged with a short reason (at most 64 characters, stored on the run). */
    public record Verdict(boolean flagged, String reason) {

        public static final Verdict OK = new Verdict(false, null);

        static Verdict flag(String reason) {
            return new Verdict(true, reason);
        }
    }

    /** Absorbs floating point noise in the limits (e.g. {@code 10 * 6 / 60}). */
    private static final double EPSILON = 1e-9;
    private static final Progress START = new Progress(0, 0, 1, 0);

    private record Progress(double elapsedSec, long kills, int level, long eurodollars) {
    }

    private final GameData gameData;
    private final AntiCheat limits;

    public AntiCheatService(GameData gameData) {
        this.gameData = gameData;
        this.limits = gameData.antiCheat();
    }

    public Verdict checkCheckpoint(RunRecord run, Optional<RunCheckpoint> previous, CheckpointRequest request,
            Instant now) {
        Progress current = new Progress(request.elapsedSec(), request.kills(), request.level(),
                request.eurodollars());
        return firstFlag(
                checkTime(run, current.elapsedSec(), now),
                () -> checkInterval(from(previous), current));
    }

    public Verdict checkEnd(RunRecord run, Optional<RunCheckpoint> last, EndRunRequest request, Instant now) {
        Progress current = new Progress(request.durationSec(), request.kills(), request.level(),
                request.eurodollarsCollected());
        return firstFlag(
                run.getCharacterId().equals(request.characterId()) ? Verdict.OK : Verdict.flag("character mismatch"),
                () -> checkTime(run, current.elapsedSec(), now),
                () -> checkIds(request),
                () -> checkKillSum(request.killsByEnemy(), request.kills()),
                () -> checkInterval(from(last), current));
    }

    @SafeVarargs
    private static Verdict firstFlag(Verdict first, Supplier<Verdict>... rest) {
        if (first.flagged()) {
            return first;
        }
        for (var check : rest) {
            Verdict verdict = check.get();
            if (verdict.flagged()) {
                return verdict;
            }
        }
        return Verdict.OK;
    }

    private Verdict checkTime(RunRecord run, double elapsedSec, Instant now) {
        if (!Double.isFinite(elapsedSec)) {
            return Verdict.flag("time not finite");
        }
        double realSec = Duration.between(run.getStartedAt(), now).toMillis() / 1000.0;
        if (elapsedSec > realSec + limits.clockSkewSec() + EPSILON) {
            return Verdict.flag("time beyond real time");
        }
        return Verdict.OK;
    }

    private Verdict checkInterval(Progress before, Progress after) {
        if (after.elapsedSec() < before.elapsedSec() || after.kills() < before.kills()
                || after.level() < before.level() || after.eurodollars() < before.eurodollars()) {
            return Verdict.flag("progress decreased");
        }
        double dt = after.elapsedSec() - before.elapsedSec();
        if (after.kills() - before.kills() > limits.maxKillsPerSec() * dt + EPSILON) {
            return Verdict.flag("kill rate");
        }
        if (after.level() - before.level() > limits.maxLevelPerMinute() * dt / 60 + EPSILON) {
            return Verdict.flag("level rate");
        }
        if (after.eurodollars() - before.eurodollars() > limits.maxEurodollarsPerMinute() * dt / 60 + EPSILON) {
            return Verdict.flag("eurodollar rate");
        }
        return Verdict.OK;
    }

    private Verdict checkIds(EndRunRequest request) {
        if (!request.killsByEnemy().keySet().stream().allMatch(gameData::isEnemy)
                || !request.enemiesSeen().stream().allMatch(gameData::isEnemy)) {
            return Verdict.flag("unknown enemy");
        }
        Predicate<String> weapon = gameData::isWeapon;
        return request.weaponsSeen().stream().allMatch(weapon) ? Verdict.OK : Verdict.flag("unknown weapon");
    }

    private static Verdict checkKillSum(Map<String, Long> killsByEnemy, long kills) {
        long sum = 0;
        try {
            for (long count : killsByEnemy.values()) {
                sum = Math.addExact(sum, count);
            }
        } catch (ArithmeticException overflow) {
            return Verdict.flag("kill sum overflow");
        }
        return sum == kills ? Verdict.OK : Verdict.flag("kills by enemy mismatch");
    }

    private static Progress from(Optional<RunCheckpoint> checkpoint) {
        return checkpoint.map(c -> new Progress(c.getElapsedSec(), c.getKills(), c.getLevel(), c.getEurodollars()))
                .orElse(START);
    }
}
