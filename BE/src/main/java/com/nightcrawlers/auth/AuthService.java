package com.nightcrawlers.auth;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.nightcrawlers.auth.RefreshTokenService.IssuedRefresh;
import com.nightcrawlers.auth.dto.LoginRequest;
import com.nightcrawlers.auth.dto.RegisterRequest;
import com.nightcrawlers.common.ApiException;
import com.nightcrawlers.common.AppProperties;
import com.nightcrawlers.common.SecureTokens;
import com.nightcrawlers.common.audit.AuditEvent;
import com.nightcrawlers.common.audit.AuditService;
import com.nightcrawlers.mail.MailService;
import com.nightcrawlers.mail.MailTemplates;
import com.nightcrawlers.save.SaveInitializer;
import com.nightcrawlers.user.Emails;
import com.nightcrawlers.user.User;
import com.nightcrawlers.user.UserRepository;

import jakarta.servlet.http.HttpServletRequest;

@Service
public class AuthService {

    static final Duration EMAIL_TOKEN_TTL = Duration.ofMinutes(30);
    static final String INVALID_CREDENTIALS = "Credenziali non valide";
    static final int FREE_FAILURES = 4;

    /** Result of a successful login or refresh. */
    public record Session(User user, String accessToken, IssuedRefresh refresh) {
    }

    private final UserRepository users;
    private final PasswordPolicy passwordPolicy;
    private final PasswordEncoder passwordEncoder;
    private final EmailTokenService emailTokens;
    private final SaveInitializer saveInitializer;
    private final MailService mail;
    private final MailTemplates templates;
    private final AuditService audit;
    private final AppProperties props;
    private final Clock clock;
    private final JwtService jwt;
    private final RefreshTokenService refreshTokens;
    /** Verified against when the login matches no user, so both paths cost one Argon2 check. */
    private final String dummyHash;

    public AuthService(UserRepository users, PasswordPolicy passwordPolicy, PasswordEncoder passwordEncoder,
            EmailTokenService emailTokens, SaveInitializer saveInitializer, MailService mail, MailTemplates templates,
            AuditService audit, AppProperties props, Clock clock, JwtService jwt,
            RefreshTokenService refreshTokens) {
        this.users = users;
        this.passwordPolicy = passwordPolicy;
        this.passwordEncoder = passwordEncoder;
        this.emailTokens = emailTokens;
        this.saveInitializer = saveInitializer;
        this.mail = mail;
        this.templates = templates;
        this.audit = audit;
        this.props = props;
        this.clock = clock;
        this.jwt = jwt;
        this.refreshTokens = refreshTokens;
        this.dummyHash = passwordEncoder.encode("timing-equalizer-" + SecureTokens.newToken());
    }

    /**
     * Creates the account, or, when the email is already registered, informs its owner and
     * answers exactly like a successful registration (no user enumeration). The username is
     * checked before the email so a 409 never depends on whether the email exists.
     */
    @Transactional
    public void register(RegisterRequest request, HttpServletRequest http) {
        String email = request.email();
        requireValidPassword(request.password(), request.username(), email);
        if (users.existsByUsernameIgnoreCase(request.username())) {
            throw new ApiException(HttpStatus.CONFLICT, "Username già in uso", "Scegli un altro username.")
                    .withError("username", "Username già in uso.");
        }
        Optional<User> existing = users.findByEmail(email);
        String hash = passwordEncoder.encode(request.password()); // same cost on both paths
        if (existing.isPresent()) {
            sendAlreadyRegistered(existing.get());
            return;
        }
        Instant now = clock.instant();
        User user = users.saveAndFlush(new User(request.username(), email, hash, now));
        saveInitializer.createFor(user.getId(), now);
        sendVerification(user);
        audit.record(AuditEvent.REGISTER, user.getId(), http);
    }

    @Transactional
    public void verifyEmail(String token) {
        User user = emailTokens.consume(token, EmailToken.Purpose.VERIFY);
        user.setEmailVerified(true);
        users.save(user);
    }

    /**
     * Not transactional on purpose: the failure counter and the audit row must be committed
     * even though the request ends with 401.
     */
    public Session login(LoginRequest request, String userAgent, HttpServletRequest http) {
        Instant now = clock.instant();
        Optional<User> found = findByLogin(request.login());
        if (found.isEmpty()) {
            passwordEncoder.matches(request.password(), dummyHash);
            audit.record(AuditEvent.LOGIN_FAILURE, null, http);
            throw invalidCredentials();
        }
        User user = found.get();
        if (user.getLockedUntil() != null && user.getLockedUntil().isAfter(now)) {
            long seconds = Math.max(1, (Duration.between(now, user.getLockedUntil()).toMillis() + 999) / 1000);
            throw new ApiException(HttpStatus.LOCKED, "Account temporaneamente bloccato",
                    "Troppi tentativi falliti. Riprova tra " + seconds + " secondi.")
                    .withHeader(HttpHeaders.RETRY_AFTER, Long.toString(seconds));
        }
        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            int failures = users.incrementFailedLogins(user.getId());
            Duration lock = lockDuration(failures);
            if (lock != null) {
                users.lockUntil(user.getId(), now.plus(lock));
            }
            audit.record(AuditEvent.LOGIN_FAILURE, user.getId(), http);
            throw invalidCredentials();
        }
        if (user.getFailedLogins() != 0 || user.getLockedUntil() != null) {
            users.resetFailedLogins(user.getId());
        }
        IssuedRefresh refresh = refreshTokens.issue(user, null, userAgent);
        audit.record(AuditEvent.LOGIN_SUCCESS, user.getId(), http);
        return new Session(user, jwt.issueAccess(user), refresh);
    }

    /** Progressive lock (spec 4.5): 1 minute at the 5th failure, 5 minutes up to the 10th, then 15. */
    static Duration lockDuration(int failures) {
        if (failures <= FREE_FAILURES) {
            return null;
        }
        if (failures == FREE_FAILURES + 1) {
            return Duration.ofMinutes(1);
        }
        return failures <= 10 ? Duration.ofMinutes(5) : Duration.ofMinutes(15);
    }

    private Optional<User> findByLogin(String login) {
        if (login.indexOf('@') >= 0) {
            return users.findByEmail(Emails.normalize(login));
        }
        return users.findByUsernameIgnoreCase(login);
    }

    private static ApiException invalidCredentials() {
        return new ApiException(HttpStatus.UNAUTHORIZED, INVALID_CREDENTIALS,
                "Username, email o password non corretti.");
    }

    void requireValidPassword(String password, String username, String email) {
        List<String> errors = passwordPolicy.validate(password, username, email);
        if (!errors.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Dati non validi", "La password non rispetta i requisiti.")
                    .withError("password", String.join(" ", errors));
        }
    }

    void sendVerification(User user) {
        String token = emailTokens.issue(user, EmailToken.Purpose.VERIFY, EMAIL_TOKEN_TTL);
        String html = templates.render("verify-email", Map.of(
                "username", user.getUsername(),
                "link", props.frontendUrl() + "/verify-email?token=" + token));
        mail.send(user.getEmail(), "Conferma il tuo indirizzo email - Nightcrawlers", html);
    }

    private void sendAlreadyRegistered(User user) {
        String html = templates.render("already-registered", Map.of(
                "username", user.getUsername(),
                "link", props.frontendUrl() + "/forgot-password"));
        mail.send(user.getEmail(), "Tentativo di registrazione - Nightcrawlers", html);
    }
}
