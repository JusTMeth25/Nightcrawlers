package com.nightcrawlers.user;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

public record UpdateLocaleRequest(
        @NotNull(message = "La lingua è obbligatoria.")
        @Pattern(regexp = "it|en|es", message = "Lingua non supportata.")
        String locale) {
}
