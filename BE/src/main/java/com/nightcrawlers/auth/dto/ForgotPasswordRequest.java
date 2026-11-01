package com.nightcrawlers.auth.dto;

import com.nightcrawlers.user.Emails;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ForgotPasswordRequest(
        @NotBlank(message = "L'email è obbligatoria.")
        @Email(message = "L'email non è valida.")
        @Size(max = 254, message = "L'email può avere al massimo 254 caratteri.")
        String email) {

    public ForgotPasswordRequest {
        email = Emails.normalize(email);
    }
}
