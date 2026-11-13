package com.nightcrawlers.auth;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.springframework.context.i18n.LocaleContextHolder;
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
import com.nightcrawlers.common.SupportedLocales;
import com.nightcrawlers.common.audit.AuditEvent;
import com.nightcrawlers.common.audit.AuditService;
import com.nightcrawlers.mail.MailOutbox;
import com.nightcrawlers.mail.MailTemplates;
import com.nightcrawlers.mail.RenderedMail;
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
    private final MailOutbox mail;
    private final MailTemplates templates;
    private final AuditService audit;
    private final AppProperties props;
    private final Clock clock;
    private final JwtService jwt;
    private final RefreshTokenService refreshTokens;
    /** Verified against when the login matches no user, so both paths cost one Argon2 check. */
    private final String dummyHash;

    public AuthService(UserRepository users, PasswordPolicy passwordPolicy, PasswordEncoder passwordEncoder,
            EmailTokenService emailTokens, SaveInitializer saveInitializer, MailOutbox mail, MailTemplates templates,
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
        User user = users.saveAndFlush(new User(request.username(), email, hash, now, emailLocale(request)));
        saveInitializer.createFor(user.getId(), now);
        sendVerification(user);
        audit.record(AuditEvent.REGISTER, user.getId(), http);
    }

    /**
     * The language of the body when given (unsupported values fall back to Italian), otherwise the
     * language of the request, already narrowed to a supported one by the locale resolver.
     */
    static String emailLocale(RegisterRequest request) {
        if (request.locale() != null) {
            return SupportedLocales.isSupported(request.locale()) ? request.locale()
                    : SupportedLocales.DEFAULT_CODE;
        }
        String fromRequest = SupportedLocales.codeOf(LocaleContextHolder.getLocale());
        return fromRequest != null ? fromRequest : SupportedLocales.DEFAULT_CODE;
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
        requireNotLocked(user, now);
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

    /** Sends a reset link only if the account exists; the caller always answers the same. */
    @Transactional
    public void forgotPassword(String normalizedEmail) {
        users.findByEmail(normalizedEmail).ifPresent(user -> {
            String token = emailTokens.issue(user, EmailToken.Purpose.RESET, EMAIL_TOKEN_TTL);
            RenderedMail body = templates.render("reset-password", Map.of(
                    "username", user.getUsername(),
                    "link", props.frontendUrl() + "/reset-password?token=" + token));
            mail.queue(user.getEmail(), "Reimposta la password - Nightcrawlers", body);
        });
    }

    /**
     * The policy is checked before the token is consumed, so a rejected password does not burn
     * the link. Proving control of the mailbox also verifies it and lifts any login lock.
     */
    @Transactional
    public void resetPassword(String token, String newPassword, HttpServletRequest http) {
        User user = emailTokens.peek(token, EmailToken.Purpose.RESET);
        requireValidPassword(newPassword, user.getUsername(), user.getEmail());
        User consumed = emailTokens.consume(token, EmailToken.Purpose.RESET);
        consumed.setPasswordHash(passwordEncoder.encode(newPassword));
        consumed.setEmailVerified(true);
        consumed.setFailedLogins(0);
        consumed.setLockedUntil(null);
        users.save(consumed);
        refreshTokens.revokeAllForUser(consumed.getId());
        audit.record(AuditEvent.PASSWORD_RESET, consumed.getId(), http);
    }

    @Transactional
    public void resendVerification(UUID userId) {
        users.findById(userId).filter(u -> !u.isEmailVerified()).ifPresent(this::sendVerification);
    }

    public Session refresh(String presentedToken, String userAgent, HttpServletRequest http) {
        RefreshTokenService.Rotation rotation = refreshTokens.rotate(presentedToken, userAgent, http);
        return new Session(rotation.user(), jwt.issueAccess(rotation.user()), rotation.next());
    }

    /** Revokes the session (refresh family) of the presented cookie; unknown tokens are ignored. */
    public void logout(String presentedToken, HttpServletRequest http) {
        refreshTokens.revokeFamilyOf(presentedToken)
                .ifPresent(userId -> audit.record(AuditEvent.LOGOUT, userId, http));
    }

    @Transactional
    public void logoutAll(UUID userId, HttpServletRequest http) {
        refreshTokens.revokeAllForUser(userId);
        audit.record(AuditEvent.LOGOUT_ALL, userId, http);
    }

    /** 423 with {@code Retry-After} while the account is locked after repeated wrong passwords. */
    public static void requireNotLocked(User user, Instant now) {
        if (user.getLockedUntil() != null && user.getLockedUntil().isAfter(now)) {
            long seconds = Math.max(1, (Duration.between(now, user.getLockedUntil()).toMillis() + 999) / 1000);
            throw new ApiException(HttpStatus.LOCKED, "Account temporaneamente bloccato",
                    "Troppi tentativi falliti. Riprova tra " + seconds + " secondi.")
                    .withHeader(HttpHeaders.RETRY_AFTER, Long.toString(seconds));
        }
    }

    /** Progressive lock (spec 4.5): 1 minute at the 5th failure, 5 minutes up to the 10th, then 15. */
    public static Duration lockDuration(int failures) {
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
        RenderedMail body = templates.render("verify-email", Map.of(
                "username", user.getUsername(),
                "link", props.frontendUrl() + "/verify-email?token=" + token));
        mail.queue(user.getEmail(), "Conferma il tuo indirizzo email - Nightcrawlers", body);
    }

    private void sendAlreadyRegistered(User user) {
        RenderedMail body = templates.render("already-registered", Map.of(
                "username", user.getUsername(),
                "link", props.frontendUrl() + "/forgot-password"));
        mail.queue(user.getEmail(), "Tentativo di registrazione - Nightcrawlers", body);
    }
}
