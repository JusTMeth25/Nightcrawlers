package com.nightcrawlers.gamedata;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

import com.nightcrawlers.gamedata.model.RipperdocDef;
import com.nightcrawlers.gamedata.model.UnlockDef;
import com.nightcrawlers.gamedata.model.UnlockRule;

class GameDataTest {

    final GameData data = GameData.load("gamedata/");

    @Test
    void startersAreTheThreeInitialCharacters() {
        assertThat(data.starters()).containsExactly("david", "lucy", "rebecca");
        assertThat(data.isCharacter("maine")).isTrue();
        assertThat(data.isCharacter("x")).isFalse();
    }

    @Test
    void knowsEnemiesAndWeapons() {
        assertThat(data.isEnemy("maxtac")).isTrue();
        assertThat(data.isEnemy("x")).isFalse();
        assertThat(data.isWeapon("heavy_rifle")).isTrue();
        assertThat(data.isWeapon("maxtac")).isFalse();
    }

    @Test
    void unlockRulesAreTyped() {
        UnlockRule kiwi = data.unlocks().stream().filter(u -> u.characterId().equals("kiwi"))
                .map(UnlockDef::rule).findFirst().orElseThrow();
        assertThat(kiwi).isEqualTo(new UnlockRule.Kills("maxtac", 50));
        assertThat(data.unlocks()).extracting(UnlockDef::rule).containsExactly(
                new UnlockRule.Survive(600),
                new UnlockRule.Kills("maxtac", 50),
                new UnlockRule.EurodollarsTotal(5000),
                new UnlockRule.SurviveWith("maine", 1800),
                new UnlockRule.DistinctCharacters(3, 900));
    }

    @Test
    void ripperdocCostGrowsGeometrically() {
        RipperdocDef def = new RipperdocDef("x", "X", 5, 100, 1.5);
        assertThat(data.ripperdocCost(def, 0)).isEqualTo(100);
        assertThat(data.ripperdocCost(def, 2)).isEqualTo(225);
        assertThat(data.ripperdoc("greed")).hasValueSatisfying(g -> {
            assertThat(g.maxRank()).isEqualTo(5);
            assertThat(g.baseCost()).isEqualTo(200);
        });
        assertThat(data.ripperdoc("nope")).isEmpty();
    }

    @Test
    void rewardAndAntiCheatBlocksAreLoaded() {
        assertThat(data.reward().perSecond()).isEqualTo(0.5);
        assertThat(data.reward().perKill()).isEqualTo(0.1);
        assertThat(data.reward().maxPerMinute()).isEqualTo(200);
        assertThat(data.antiCheat().clockSkewSec()).isEqualTo(5);
        assertThat(data.antiCheat().maxKillsPerSec()).isEqualTo(40);
        assertThat(data.antiCheat().maxLevelPerMinute()).isEqualTo(10);
        assertThat(data.antiCheat().maxEurodollarsPerMinute()).isEqualTo(300);
    }

    @Test
    void missingFilesFailFast() {
        assertThatThrownBy(() -> GameData.load("no-such-dir/"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("characters.json");
    }

    @Test
    void invalidDataFailsFast() {
        assertThatThrownBy(() -> GameData.load("gamedata-invalid/"))
                .isInstanceOf(IllegalStateException.class);
    }
}
