package com.nightcrawlers.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** {@code login} is a username or an email. */
public record LoginRequest(
        @NotBlank(message = "{validation.login.required}") @Size(max = 254, message = "{validation.login.tooLong}") String login,
        @NotBlank(message = "{validation.password.enter}") @Size(max = 128, message = "{validation.password.tooLong}") String password) {

    public LoginRequest {
        login = login == null ? null : login.trim();
    }

    @Override
    public String toString() {
        return "LoginRequest[login=" + login + "]";
    }
}
