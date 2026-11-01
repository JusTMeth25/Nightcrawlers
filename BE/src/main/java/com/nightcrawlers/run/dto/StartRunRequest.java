package com.nightcrawlers.run.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record StartRunRequest(@NotBlank @Size(max = 32) String characterId) {
}
