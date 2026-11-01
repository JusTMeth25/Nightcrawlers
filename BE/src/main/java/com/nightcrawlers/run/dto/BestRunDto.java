package com.nightcrawlers.run.dto;

import java.time.Instant;
import java.util.UUID;

public record BestRunDto(UUID id, String characterId, int durationSec, long kills, int level, Instant endedAt) {
}
