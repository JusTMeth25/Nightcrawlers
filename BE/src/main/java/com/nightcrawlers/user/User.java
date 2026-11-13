package com.nightcrawlers.user;

import java.time.Instant;
import java.util.UUID;

import com.nightcrawlers.common.SupportedLocales;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "users")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class User {

    @Id
    private UUID id;

    @Column(nullable = false, length = 20)
    private String username;

    /** Always trimmed and lower case. */
    @Column(nullable = false, length = 254)
    private String email;

    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    @Column(name = "email_verified", nullable = false)
    private boolean emailVerified;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "failed_logins", nullable = false)
    private int failedLogins;

    @Column(name = "locked_until")
    private Instant lockedUntil;

    /** Language of the emails: one of {@link com.nightcrawlers.common.SupportedLocales#CODES}. */
    @Column(nullable = false, length = 5)
    private String locale = SupportedLocales.DEFAULT_CODE;

    public User(String username, String email, String passwordHash, Instant createdAt) {
        this.id = UUID.randomUUID();
        this.username = username;
        this.email = email;
        this.passwordHash = passwordHash;
        this.createdAt = createdAt;
    }

    public User(String username, String email, String passwordHash, Instant createdAt, String locale) {
        this(username, email, passwordHash, createdAt);
        this.locale = locale;
    }

    /** The email language as a {@link java.util.Locale}. */
    public java.util.Locale emailLocale() {
        return SupportedLocales.toLocale(locale);
    }
}
