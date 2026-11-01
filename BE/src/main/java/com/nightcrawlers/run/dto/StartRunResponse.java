package com.nightcrawlers.run.dto;

import java.time.Instant;
import java.util.UUID;

/** {@code seed} is in {@code [0, 2147483646]}. */
public record StartRunResponse(UUID runId, int seed, Instant startedAt) {
}
