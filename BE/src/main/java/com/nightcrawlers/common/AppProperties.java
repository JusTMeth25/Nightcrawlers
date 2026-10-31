package com.nightcrawlers.common;

import java.time.Duration;
import java.util.List;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** Typed view of the {@code app.*} properties. Startup fails if a required value is missing. */
@Validated
@ConfigurationProperties(prefix = "app")
public record AppProperties(
        @Valid @NotNull Jwt jwt,
        @Valid @NotNull Refresh refresh,
        @Valid @NotNull Cors cors,
        @Valid @NotNull Mail mail,
        @NotBlank String frontendUrl,
        @NotBlank String ipHashSalt,
        @Valid @NotNull Cookies cookies) {

    public record Jwt(@NotBlank @Size(min = 32) String secret, @NotNull Duration accessTtl) {
    }

    public record Refresh(@NotNull Duration ttl) {
    }

    public record Cors(@NotEmpty List<String> allowedOrigins) {
    }

    public record Mail(@NotBlank String from) {
    }

    public record Cookies(boolean secure) {
    }
}
