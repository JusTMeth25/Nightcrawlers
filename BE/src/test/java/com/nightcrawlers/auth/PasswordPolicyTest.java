package com.nightcrawlers.auth;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;

class PasswordPolicyTest {

    private final PasswordPolicy policy = new PasswordPolicy();

    @Test
    void elevenCharactersIsTooShort() {
        assertThat(policy.validate("Vy7#kq2!Lp9", "mario", "mario@mail.it"))
                .anySatisfy(e -> assertThat(e).contains("minimo 12 caratteri"));
    }

    @Test
    void maximumIs128Characters() {
        assertThat(policy.validate("aB3$".repeat(32), "mario", "mario@mail.it")).isEmpty();
        assertThat(policy.validate("aB3$".repeat(32) + "x", "mario", "mario@mail.it"))
                .anySatisfy(e -> assertThat(e).contains("massimo 128"));
    }

    @Test
    void commonPasswordsAreRejected() {
        assertThat(policy.validate("password1234", "mario", "mario@mail.it"))
                .anySatisfy(e -> assertThat(e).contains("password troppo comune"));
        // list entry of 12+ characters, any case
        assertThat(policy.validate("Unbelievable", "mario", "mario@mail.it"))
                .anySatisfy(e -> assertThat(e).contains("password troppo comune"));
    }

    @Test
    void passwordContainingUsernameIsRejectedCaseInsensitive() {
        assertThat(policy.validate("xxNightRider_77zz", "nightrider", "a@b.it"))
                .anySatisfy(e -> assertThat(e).contains("non deve contenere lo username"));
    }

    @Test
    void passwordContainingEmailLocalPartIsRejected() {
        assertThat(policy.validate("q9!Zmariorossi#4", "player_1", "Mario.Rossi@mail.it".toLowerCase()))
                .isEmpty();
        assertThat(policy.validate("q9!Zmario.rossi#4", "player_1", "mario.rossi@mail.it"))
                .anySatisfy(e -> assertThat(e).contains("non deve contenere l'email"));
    }

    @Test
    void strongPasswordIsValid() {
        assertThat(policy.validate("Vy7#kq2!Lp9z", "mario", "mario@mail.it")).isEmpty();
    }

    @Test
    void nullPasswordIsInvalid() {
        List<String> errors = policy.validate(null, "mario", "mario@mail.it");
        assertThat(errors).isNotEmpty();
    }

    @Test
    void encoderIsArgon2id() {
        PasswordEncoder encoder = new PasswordConfig().passwordEncoder();
        String hash = encoder.encode("Vy7#kq2!Lp9z");
        assertThat(hash).startsWith("$argon2id$");
        assertThat(encoder.matches("Vy7#kq2!Lp9z", hash)).isTrue();
        assertThat(encoder.matches("Vy7#kq2!Lp9Z", hash)).isFalse();
    }
}
