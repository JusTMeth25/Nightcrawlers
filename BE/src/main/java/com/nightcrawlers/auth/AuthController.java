package com.nightcrawlers.auth;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.nightcrawlers.auth.dto.AuthResponse;
import com.nightcrawlers.auth.dto.LoginRequest;
import com.nightcrawlers.auth.dto.MessageResponse;
import com.nightcrawlers.auth.dto.RegisterRequest;
import com.nightcrawlers.auth.dto.VerifyEmailRequest;

import com.nightcrawlers.common.SecureTokens;
import com.nightcrawlers.user.UserDto;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    static final MessageResponse REGISTERED = new MessageResponse(
            "Registrazione ricevuta: controlla la tua email per confermare l'account.");

    private final AuthService auth;
    private final AuthCookies cookies;
    private final JwtService jwt;

    public AuthController(AuthService auth, AuthCookies cookies, JwtService jwt) {
        this.auth = auth;
        this.cookies = cookies;
        this.jwt = jwt;
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public MessageResponse register(@Valid @RequestBody RegisterRequest request, HttpServletRequest http) {
        auth.register(request, http);
        return REGISTERED;
    }

    @PostMapping("/verify-email")
    public ResponseEntity<Void> verifyEmail(@Valid @RequestBody VerifyEmailRequest request) {
        auth.verifyEmail(request.token());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest request, HttpServletRequest http,
            HttpServletResponse response) {
        AuthService.Session session = auth.login(request, http.getHeader(HttpHeaders.USER_AGENT), http);
        return respond(session, response);
    }

    @PostMapping("/refresh")
    public AuthResponse refresh(@CookieValue(name = AuthCookies.REFRESH, required = false) String refreshToken,
            HttpServletRequest http, HttpServletResponse response) {
        AuthService.Session session = auth.refresh(refreshToken, http.getHeader(HttpHeaders.USER_AGENT), http);
        return respond(session, response);
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(@CookieValue(name = AuthCookies.REFRESH, required = false) String refreshToken,
            HttpServletRequest http, HttpServletResponse response) {
        auth.logout(refreshToken, http);
        cookies.clear(response);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/logout-all")
    public ResponseEntity<Void> logoutAll(Authentication authentication, HttpServletRequest http,
            HttpServletResponse response) {
        auth.logoutAll(CurrentUser.id(authentication), http);
        cookies.clear(response);
        return ResponseEntity.noContent().build();
    }

    private AuthResponse respond(AuthService.Session session, HttpServletResponse response) {
        cookies.write(response, session.refresh(), SecureTokens.newToken());
        return new AuthResponse(session.accessToken(), jwt.accessTtlSeconds(), UserDto.from(session.user()));
    }
}
