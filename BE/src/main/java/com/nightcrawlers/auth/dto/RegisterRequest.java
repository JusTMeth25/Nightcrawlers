package com.nightcrawlers.auth.dto;

import com.nightcrawlers.user.Emails;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record RegisterRequest(
        @NotBlank(message = "Lo username è obbligatorio.")
        @Pattern(regexp = "^[a-zA-Z0-9_]{3,20}$",
                message = "Lo username deve avere da 3 a 20 caratteri tra lettere, numeri e _.")
        String username,
        @NotBlank(message = "L'email è obbligatoria.")
        @Email(message = "L'email non è valida.")
        @Size(max = 254, message = "L'email può avere al massimo 254 caratteri.")
        String email,
        @NotNull(message = "La password è obbligatoria.")
        String password) {

    /** Normalized before Bean Validation runs. */
    public RegisterRequest {
        email = Emails.normalize(email);
    }

    @Override
    public String toString() {
        return "RegisterRequest[username=" + username + ", email=" + email + "]";
    }
}
