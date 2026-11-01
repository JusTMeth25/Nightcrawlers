package com.nightcrawlers.auth;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

/** {@code app.rate-limit.*}: requests allowed per period, per IP or per account. */
@Validated
@ConfigurationProperties(prefix = "app.rate-limit")
public record RateLimitProperties(
        @Valid @NotNull Limit register,
        @Valid @NotNull Limit loginIp,
        @Valid @NotNull Limit loginAccount,
        @Valid @NotNull Limit refreshIp,
        @Valid @NotNull Limit forgotAccount,
        @Valid @NotNull Limit forgotIp,
        @Valid @NotNull Limit resetIp) {

    public record Limit(@Positive long capacity, @NotNull Duration period) {
    }
}
