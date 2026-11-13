package com.nightcrawlers.user;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

public record UpdateLocaleRequest(
        @NotNull(message = "{validation.locale.required}")
        @Pattern(regexp = "it|en|es", message = "{validation.locale.unsupported}")
        String locale) {
}
