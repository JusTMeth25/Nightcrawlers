package com.nightcrawlers.run.dto;

import java.util.List;
import java.util.Map;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

/**
 * Contract {@code EndRunRequest}. The collection sizes are capped only to bound the work per
 * request; the game data has far fewer ids.
 */
public record EndRunRequest(
        @NotBlank @Size(max = 32) String characterId,
        @NotNull @PositiveOrZero Double durationSec,
        @NotNull @PositiveOrZero Long kills,
        @NotNull @Size(max = 100) Map<@NotBlank @Size(max = 32) String, @NotNull @PositiveOrZero Long> killsByEnemy,
        @NotNull @Min(1) Integer level,
        @NotNull @PositiveOrZero Long eurodollarsCollected,
        @NotNull @Size(max = 100) List<@NotBlank @Size(max = 32) String> weaponsSeen,
        @NotNull @Size(max = 100) List<@NotBlank @Size(max = 32) String> enemiesSeen) {
}
