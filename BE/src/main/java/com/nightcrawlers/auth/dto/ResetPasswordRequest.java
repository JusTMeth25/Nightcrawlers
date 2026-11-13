package com.nightcrawlers.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record ResetPasswordRequest(
        @NotBlank(message = "{validation.token.required}") @Size(max = 256, message = "{validation.token.invalid}") String token,
        @NotNull(message = "{validation.newPassword.required}") String newPassword) {

    @Override
    public String toString() {
        return "ResetPasswordRequest[]";
    }
}
