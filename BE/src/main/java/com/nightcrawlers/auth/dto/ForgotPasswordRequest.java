package com.nightcrawlers.auth.dto;

import com.nightcrawlers.user.Emails;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ForgotPasswordRequest(
        @NotBlank(message = "{validation.email.required}")
        @Email(message = "{validation.email.invalid}")
        @Size(max = 254, message = "{validation.email.tooLong}")
        String email) {

    public ForgotPasswordRequest {
        email = Emails.normalize(email);
    }
}
