package com.nightcrawlers.run;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

import com.nightcrawlers.gamedata.GameData;

class RunServiceTest {

    private final GameData gameData = GameData.load("gamedata/");

    @Test
    void codexStoresBaseWeaponIds() {
        assertThat(RunService.codexWeaponId(gameData, "pistol")).isEqualTo("pistol");
        assertThat(RunService.codexWeaponId(gameData, "pistol_evo")).isEqualTo("pistol");
        assertThat(RunService.codexWeaponId(gameData, "smart_pistol_evo")).isEqualTo("smart_pistol");
    }

    @Test
    void wholeSecondsAreFlooredAndBounded() {
        assertThat(RunService.wholeSeconds(605.9)).isEqualTo(605);
        assertThat(RunService.wholeSeconds(-1)).isZero();
        assertThat(RunService.wholeSeconds(Double.NaN)).isZero();
        assertThat(RunService.wholeSeconds(1e12)).isEqualTo(Integer.MAX_VALUE);
    }
}
