package com.nightcrawlers.run;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

import com.nightcrawlers.gamedata.GameData;

/** balance.json reward: perSecond 0.5, perKill 0.1, maxPerMinute 200. */
class RewardCalculatorTest {

    private final RewardCalculator calculator = new RewardCalculator(GameData.load("gamedata/"));

    @Test
    void durationAndKillsBelowTheCap() {
        // floor(min(600*0.5 + 300*0.1, 200*10)) = 330
        assertThat(calculator.compute(600, 300, 0)).isEqualTo(330);
    }

    @Test
    void capOfMaxPerMinuteTimesStartedMinutes() {
        // min(30 + 10000, 200 * ceil(60/60)) = 200
        assertThat(calculator.compute(60, 100_000, 0)).isEqualTo(200);
    }

    @Test
    void capCountsEveryStartedMinute() {
        // 61 s -> ceil(61/60) = 2 minutes -> cap 400
        assertThat(calculator.compute(61, 100_000, 0)).isEqualTo(400);
    }

    @Test
    void greedAddsTenPercentPerRank() {
        assertThat(calculator.compute(600, 300, 5)).isEqualTo(495);
        // 330 * 1.3 = 429 exactly: no floating point loss below the integer
        assertThat(calculator.compute(600, 300, 3)).isEqualTo(429);
    }

    @Test
    void fractionsAreFloored() {
        // 1 s -> 0.5 -> 0
        assertThat(calculator.compute(1, 0, 0)).isZero();
        // 3 s + 1 kill -> 1.5 + 0.1 = 1.6 -> 1
        assertThat(calculator.compute(3, 1, 0)).isEqualTo(1);
    }

    @Test
    void emptyRunEarnsNothing() {
        assertThat(calculator.compute(0, 0, 5)).isZero();
    }
}
