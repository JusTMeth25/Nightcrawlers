package com.nightcrawlers.auth;

import java.time.Clock;
import java.time.Duration;

import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

import com.nightcrawlers.auth.RefreshTokenService.IssuedRefresh;
import com.nightcrawlers.common.AppProperties;

import jakarta.servlet.http.HttpServletResponse;

/**
 * {@code refresh_token}: HttpOnly; Secure; SameSite=Strict; Path=/api/auth.
 * {@code XSRF-TOKEN}: readable by JS (double-submit CSRF); Secure; SameSite=Strict; Path=/.
 * {@code Secure} follows {@code app.cookies.secure} (off only for local HTTP testing).
 */
@Component
public class AuthCookies {

    public static final String REFRESH = "refresh_token";
    public static final String CSRF = "XSRF-TOKEN";
    public static final String CSRF_HEADER = "X-CSRF-Token";
    static final String REFRESH_PATH = "/api/auth";

    private final boolean secure;
    private final Clock clock;

    public AuthCookies(AppProperties props, Clock clock) {
        this.secure = props.cookies().secure();
        this.clock = clock;
    }

    /** Both cookies live exactly as long as the refresh token. */
    public void write(HttpServletResponse response, IssuedRefresh refresh, String csrfToken) {
        long millis = Duration.between(clock.instant(), refresh.expiresAt()).toMillis();
        Duration maxAge = Duration.ofSeconds(Math.max(0, (millis + 999) / 1000)); // whole seconds, rounded up
        add(response, ResponseCookie.from(REFRESH, refresh.token())
                .httpOnly(true).secure(secure).sameSite("Strict").path(REFRESH_PATH).maxAge(maxAge).build());
        add(response, ResponseCookie.from(CSRF, csrfToken)
                .httpOnly(false).secure(secure).sameSite("Strict").path("/").maxAge(maxAge).build());
    }

    public void clear(HttpServletResponse response) {
        add(response, ResponseCookie.from(REFRESH, "")
                .httpOnly(true).secure(secure).sameSite("Strict").path(REFRESH_PATH).maxAge(0).build());
        add(response, ResponseCookie.from(CSRF, "")
                .httpOnly(false).secure(secure).sameSite("Strict").path("/").maxAge(0).build());
    }

    private static void add(HttpServletResponse response, ResponseCookie cookie) {
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }
}
