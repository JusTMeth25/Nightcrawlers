package com.nightcrawlers.common;

import java.time.Duration;
import java.util.List;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;
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

    /**
     * {@code ttl}: sliding lifetime of each token; {@code absoluteTtl}: cap for a whole login (family);
     * {@code reuseGrace}: how long a just-rotated token may be presented again (benign race).
     */
    public record Refresh(@NotNull Duration ttl, @NotNull Duration absoluteTtl,
            @DefaultValue("PT20S") @NotNull Duration reuseGrace) {
    }

    public record Cors(@NotEmpty List<String> allowedOrigins) {
    }

    public record Mail(@NotBlank String from) {
    }

    public record Cookies(boolean secure) {
    }
}
