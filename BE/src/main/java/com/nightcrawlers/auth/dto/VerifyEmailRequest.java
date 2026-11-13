package com.nightcrawlers.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record VerifyEmailRequest(
        @NotBlank(message = "{validation.token.required}") @Size(max = 256, message = "{validation.token.invalid}") String token) {
}
