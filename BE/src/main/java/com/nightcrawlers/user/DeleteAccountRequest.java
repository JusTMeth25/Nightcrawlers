package com.nightcrawlers.user;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record DeleteAccountRequest(@NotBlank(message = "{validation.password.enter}") @Size(max = 128, message = "{validation.password.tooLong}") String password) {
}
