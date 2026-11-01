package com.nightcrawlers.run.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

/** Contract {@code RunCheckpoint}: progress at {@code elapsedSec} seconds of game time. */
public record CheckpointRequest(
        @NotNull @PositiveOrZero Double elapsedSec,
        @NotNull @PositiveOrZero Long kills,
        @NotNull @Min(1) Integer level,
        @NotNull @PositiveOrZero Long eurodollars) {
}
