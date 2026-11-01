package com.nightcrawlers.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record ResetPasswordRequest(
        @NotBlank(message = "Il token è obbligatorio.") @Size(max = 256, message = "Token non valido.") String token,
        @NotNull(message = "La nuova password è obbligatoria.") String newPassword) {

    @Override
    public String toString() {
        return "ResetPasswordRequest[]";
    }
}
