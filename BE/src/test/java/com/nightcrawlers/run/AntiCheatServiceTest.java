package com.nightcrawlers.run;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.Test;

import com.nightcrawlers.gamedata.GameData;
import com.nightcrawlers.run.AntiCheatService.Verdict;
import com.nightcrawlers.run.dto.CheckpointRequest;
import com.nightcrawlers.run.dto.EndRunRequest;

/** balance.json antiCheat: skew 5 s, 40 kills/s, 10 levels/min, 300 €$/min. */
class AntiCheatServiceTest {

    private static final Instant START = Instant.parse("2026-11-01T10:00:00Z");

    private final AntiCheatService antiCheat = new AntiCheatService(GameData.load("gamedata/"));
    private final RunRecord run = new RunRecord(UUID.randomUUID(), "david", 42, START);

    private static Instant at(double seconds) {
        return START.plusMillis((long) (seconds * 1000));
    }

    private static CheckpointRequest cp(double elapsed, long kills, int level, long eurodollars) {
        return new CheckpointRequest(elapsed, kills, level, eurodollars);
    }

    private Optional<RunCheckpoint> previous(double elapsed, long kills, int level, long eurodollars) {
        return Optional.of(new RunCheckpoint(run.getId(), at(elapsed), elapsed, kills, level, eurodollars));
    }

    private static EndRunRequest end(double duration, long kills, Map<String, Long> byEnemy) {
        return new EndRunRequest("david", duration, kills, byEnemy, 1, 0L, List.of("pistol"),
                List.copyOf(byEnemy.keySet()));
    }

    @Test
    void plausibleCheckpointIsOk() {
        assertThat(antiCheat.checkCheckpoint(run, Optional.empty(), cp(60, 300, 5, 100), at(61)))
                .isEqualTo(Verdict.OK);
    }

    @Test
    void elapsedBeyondRealTimePlusSkewIsFlagged() {
        assertThat(antiCheat.checkCheckpoint(run, Optional.empty(), cp(65, 0, 1, 0), at(60)).flagged()).isFalse();
        Verdict verdict = antiCheat.checkCheckpoint(run, Optional.empty(), cp(65.5, 0, 1, 0), at(60));
        assertThat(verdict.flagged()).isTrue();
        assertThat(verdict.reason()).isNotBlank();
    }

    @Test
    void decreasingValuesAreFlagged() {
        Optional<RunCheckpoint> prev = previous(60, 500, 6, 200);
        assertThat(antiCheat.checkCheckpoint(run, prev, cp(120, 499, 6, 200), at(121)).flagged()).isTrue();
        assertThat(antiCheat.checkCheckpoint(run, prev, cp(120, 500, 5, 200), at(121)).flagged()).isTrue();
        assertThat(antiCheat.checkCheckpoint(run, prev, cp(120, 500, 6, 199), at(121)).flagged()).isTrue();
        assertThat(antiCheat.checkCheckpoint(run, prev, cp(59, 500, 6, 200), at(121)).flagged()).isTrue();
        assertThat(antiCheat.checkCheckpoint(run, prev, cp(120, 500, 6, 200), at(121)).flagged()).isFalse();
    }

    @Test
    void killRateIsLimitedPerInterval() {
        Optional<RunCheckpoint> prev = previous(60, 100, 3, 0);
        // 60 s interval: 40 kills/s -> +2400 allowed, 41 kills/s -> +2460 flagged
        assertThat(antiCheat.checkCheckpoint(run, prev, cp(120, 2500, 3, 0), at(121))).isEqualTo(Verdict.OK);
        assertThat(antiCheat.checkCheckpoint(run, prev, cp(120, 2560, 3, 0), at(121)).flagged()).isTrue();
    }

    @Test
    void firstCheckpointIsMeasuredFromTheStart() {
        assertThat(antiCheat.checkCheckpoint(run, Optional.empty(), cp(60, 2400, 1, 0), at(61)))
                .isEqualTo(Verdict.OK);
        assertThat(antiCheat.checkCheckpoint(run, Optional.empty(), cp(60, 2460, 1, 0), at(61)).flagged()).isTrue();
    }

    @Test
    void levelAndEurodollarRatesAreLimited() {
        // first checkpoint starts from level 1 and 0 €$: 60 s -> +10 levels, +300 €$
        assertThat(antiCheat.checkCheckpoint(run, Optional.empty(), cp(60, 0, 11, 300), at(61)))
                .isEqualTo(Verdict.OK);
        assertThat(antiCheat.checkCheckpoint(run, Optional.empty(), cp(60, 0, 12, 0), at(61)).flagged()).isTrue();
        assertThat(antiCheat.checkCheckpoint(run, Optional.empty(), cp(60, 0, 1, 301), at(61)).flagged()).isTrue();
    }

    @Test
    void plausibleEndIsOk() {
        EndRunRequest request = new EndRunRequest("david", 605.0, 300L, Map.of("maelstrom", 250L, "maxtac", 50L),
                20, 800L, List.of("pistol", "shotgun"), List.of("maelstrom", "maxtac"));
        Verdict verdict = antiCheat.checkEnd(run, previous(60, 100, 3, 50), request, at(610));
        assertThat(verdict).isEqualTo(Verdict.OK);
    }

    @Test
    void endWithoutCheckpointsIsMeasuredFromTheStart() {
        assertThat(antiCheat.checkEnd(run, Optional.empty(), end(10, 400, Map.of("maelstrom", 400L)), at(11)))
                .isEqualTo(Verdict.OK);
        assertThat(antiCheat.checkEnd(run, Optional.empty(), end(10, 401, Map.of("maelstrom", 401L)), at(11))
                .flagged()).isTrue();
    }

    @Test
    void endBeyondRealTimeIsFlagged() {
        assertThat(antiCheat.checkEnd(run, Optional.empty(), end(700, 0, Map.of()), at(610)).flagged()).isTrue();
    }

    @Test
    void endBeforeTheLastCheckpointIsFlagged() {
        assertThat(antiCheat.checkEnd(run, previous(120, 0, 1, 0), end(119, 0, Map.of()), at(200)).flagged())
                .isTrue();
    }

    @Test
    void endWithFewerKillsThanTheLastCheckpointIsFlagged() {
        assertThat(antiCheat.checkEnd(run, previous(120, 50, 1, 0), end(130, 40, Map.of("maelstrom", 40L)),
                at(200)).flagged()).isTrue();
    }

    @Test
    void unknownEnemyIsFlagged() {
        assertThat(antiCheat.checkEnd(run, Optional.empty(), end(100, 10, Map.of("dragon", 10L)), at(101))
                .flagged()).isTrue();
        EndRunRequest seen = new EndRunRequest("david", 100.0, 0L, Map.of(), 1, 0L, List.of(), List.of("dragon"));
        assertThat(antiCheat.checkEnd(run, Optional.empty(), seen, at(101)).flagged()).isTrue();
    }

    @Test
    void unknownWeaponIsFlagged() {
        EndRunRequest request = new EndRunRequest("david", 100.0, 0L, Map.of(), 1, 0L, List.of("bfg"), List.of());
        assertThat(antiCheat.checkEnd(run, Optional.empty(), request, at(101)).flagged()).isTrue();
    }

    @Test
    void killsByEnemyMustAddUpToKills() {
        assertThat(antiCheat.checkEnd(run, Optional.empty(), end(100, 30, Map.of("maelstrom", 20L, "maxtac", 9L)),
                at(101)).flagged()).isTrue();
    }

    @Test
    void hugeKillCountsDoNotOverflowTheSum() {
        EndRunRequest request = end(100, 10, Map.of("maelstrom", Long.MAX_VALUE, "maxtac", 11L));
        assertThat(antiCheat.checkEnd(run, Optional.empty(), request, at(101)).flagged()).isTrue();
    }

    @Test
    void characterDifferentFromTheRunIsFlagged() {
        EndRunRequest request = new EndRunRequest("lucy", 100.0, 0L, Map.of(), 1, 0L, List.of(), List.of());
        assertThat(antiCheat.checkEnd(run, Optional.empty(), request, at(101)).flagged()).isTrue();
    }

    @Test
    void nonFiniteNumbersAreFlagged() {
        assertThat(antiCheat.checkCheckpoint(run, Optional.empty(), cp(Double.NaN, 0, 1, 0), at(60)).flagged())
                .isTrue();
        EndRunRequest request = new EndRunRequest("david", Double.POSITIVE_INFINITY, 0L, Map.of(), 1, 0L, List.of(),
                List.of());
        assertThat(antiCheat.checkEnd(run, Optional.empty(), request, at(101)).flagged()).isTrue();
    }
}
