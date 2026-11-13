package com.nightcrawlers.auth.dto;

import com.nightcrawlers.user.Emails;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record RegisterRequest(
        @NotBlank(message = "{validation.username.required}")
        @Pattern(regexp = "^[a-zA-Z0-9_]{3,20}$",
                message = "{validation.username.pattern}")
        String username,
        @NotBlank(message = "{validation.email.required}")
        @Email(message = "{validation.email.invalid}")
        @Size(max = 254, message = "{validation.email.tooLong}")
        String email,
        @NotNull(message = "{validation.password.required}")
        String password,
        /** Optional email language; unsupported values fall back to Italian. */
        String locale) {

    /** Normalized before Bean Validation runs. */
    public RegisterRequest {
        email = Emails.normalize(email);
    }

    @Override
    public String toString() {
        return "RegisterRequest[username=" + username + ", email=" + email + "]";
    }
}
