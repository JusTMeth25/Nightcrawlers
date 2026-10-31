package com.nightcrawlers.auth;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.nightcrawlers.auth.dto.MessageResponse;
import com.nightcrawlers.auth.dto.RegisterRequest;
import com.nightcrawlers.auth.dto.VerifyEmailRequest;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    static final MessageResponse REGISTERED = new MessageResponse(
            "Registrazione ricevuta: controlla la tua email per confermare l'account.");

    private final AuthService auth;

    public AuthController(AuthService auth) {
        this.auth = auth;
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
}
