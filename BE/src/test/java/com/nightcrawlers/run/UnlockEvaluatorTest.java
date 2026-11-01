package com.nightcrawlers.run;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;
import java.util.Set;

import org.junit.jupiter.api.Test;

import com.nightcrawlers.gamedata.GameData;
import com.nightcrawlers.run.UnlockEvaluator.Progress;

class UnlockEvaluatorTest {

    private static final Set<String> STARTERS = Set.of("david", "lucy", "rebecca");

    private final UnlockEvaluator evaluator = new UnlockEvaluator(GameData.load("gamedata/"));

    private static Progress progress(int bestTimeSec, Map<String, Long> kills, long totalEarned,
            Map<String, Integer> characterBest) {
        return new Progress(bestTimeSec, kills, totalEarned, characterBest);
    }

    @Test
    void nothingForAFreshSave() {
        assertThat(evaluator.newUnlocks(progress(0, Map.of(), 0, Map.of()), STARTERS)).isEmpty();
    }

    @Test
    void survivingTenMinutesUnlocksMaine() {
        assertThat(evaluator.newUnlocks(progress(600, Map.of(), 0, Map.of("david", 600)), STARTERS))
                .containsExactly("maine");
        assertThat(evaluator.newUnlocks(progress(599, Map.of(), 0, Map.of("david", 599)), STARTERS)).isEmpty();
    }

    @Test
    void fiftyMaxtacKillsUnlockKiwi() {
        assertThat(evaluator.newUnlocks(progress(0, Map.of("maxtac", 50L), 0, Map.of()), STARTERS))
                .containsExactly("kiwi");
        assertThat(evaluator.newUnlocks(progress(0, Map.of("maxtac", 49L, "maelstrom", 500L), 0, Map.of()),
                STARTERS)).isEmpty();
    }

    @Test
    void fiveThousandEurodollarsUnlockPilar() {
        assertThat(evaluator.newUnlocks(progress(0, Map.of(), 5000, Map.of()), STARTERS)).containsExactly("pilar");
        assertThat(evaluator.newUnlocks(progress(0, Map.of(), 4999, Map.of()), STARTERS)).isEmpty();
    }

    @Test
    void thirtyMinutesWithMaineUnlocksDorio() {
        Set<String> unlocked = Set.of("david", "lucy", "rebecca", "maine");
        assertThat(evaluator.newUnlocks(progress(1800, Map.of(), 0, Map.of("maine", 1800)), unlocked))
                .containsExactly("dorio");
        // 30 minutes with another character is not enough
        assertThat(evaluator.newUnlocks(progress(1800, Map.of(), 0, Map.of("david", 1800, "maine", 100)), unlocked))
                .isEmpty();
    }

    @Test
    void fifteenMinutesWithThreeCharactersUnlocksFalco() {
        Set<String> unlocked = Set.of("david", "lucy", "rebecca", "maine");
        assertThat(evaluator.newUnlocks(progress(900, Map.of(), 0,
                Map.of("david", 900, "lucy", 950, "rebecca", 901)), unlocked)).containsExactly("falco");
    }

    @Test
    void twoCharactersAreNotEnoughForFalco() {
        Set<String> unlocked = Set.of("david", "lucy", "rebecca", "maine");
        assertThat(evaluator.newUnlocks(progress(900, Map.of(), 0,
                Map.of("david", 900, "lucy", 950, "rebecca", 899)), unlocked)).isEmpty();
    }

    @Test
    void alreadyUnlockedCharactersAreExcluded() {
        Set<String> unlocked = Set.of("david", "lucy", "rebecca", "maine", "kiwi");
        assertThat(evaluator.newUnlocks(progress(700, Map.of("maxtac", 80L), 6000, Map.of("david", 700)),
                unlocked)).containsExactly("pilar");
    }

    @Test
    void severalUnlocksComeInGameDataOrder() {
        assertThat(evaluator.newUnlocks(progress(700, Map.of("maxtac", 80L), 6000, Map.of("david", 700)),
                STARTERS)).containsExactly("maine", "kiwi", "pilar");
    }
}
