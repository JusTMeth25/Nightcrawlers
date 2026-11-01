package com.nightcrawlers.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** {@code login} is a username or an email. */
public record LoginRequest(
        @NotBlank(message = "Inserisci username o email.") @Size(max = 254, message = "Valore troppo lungo.") String login,
        @NotBlank(message = "Inserisci la password.") @Size(max = 128, message = "Password troppo lunga.") String password) {

    public LoginRequest {
        login = login == null ? null : login.trim();
    }

    @Override
    public String toString() {
        return "LoginRequest[login=" + login + "]";
    }
}
