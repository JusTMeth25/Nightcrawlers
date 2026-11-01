package com.nightcrawlers.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record VerifyEmailRequest(
        @NotBlank(message = "Il token è obbligatorio.") @Size(max = 256, message = "Token non valido.") String token) {
}
