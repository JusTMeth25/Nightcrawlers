package com.nightcrawlers.auth;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

import org.springframework.stereotype.Component;

/**
 * Password rules (spec 4.5): 12 to 128 characters, not among the 10,000 most common passwords,
 * not containing the username or the email local part.
 */
@Component
public class PasswordPolicy {

    public static final int MIN_LENGTH = 12;
    public static final int MAX_LENGTH = 128;

    private static final String LIST_RESOURCE = "/security/common-passwords.txt";
    /** Digits and symbols people append to a common word to reach the minimum length. */
    private static final Pattern TRAILING_FILLER = Pattern.compile("[\\d\\p{Punct}\\s]+$");
    private static final Pattern LEADING_FILLER = Pattern.compile("^[\\d\\p{Punct}\\s]+");
    private static final int MIN_IDENTITY_LENGTH = 3;

    private final Set<String> common;

    public PasswordPolicy() {
        this.common = load();
    }

    /** A violated rule: a key of {@code i18n/messages_*.properties} with its arguments. */
    public record Violation(String key, Object... args) {
    }

    static final String TOO_SHORT = "password.tooShort";
    static final String TOO_LONG = "password.tooLong";
    static final String COMMON = "password.common";
    static final String CONTAINS_USERNAME = "password.containsUsername";
    static final String CONTAINS_EMAIL = "password.containsEmail";

    /** @return the violated rules as message keys; empty when the password is valid */
    public List<Violation> validate(String password, String username, String email) {
        List<Violation> errors = new ArrayList<>();
        if (password == null || password.isEmpty()) {
            errors.add(new Violation(TOO_SHORT, MIN_LENGTH));
            return errors;
        }
        int length = password.codePointCount(0, password.length());
        if (length < MIN_LENGTH) {
            errors.add(new Violation(TOO_SHORT, MIN_LENGTH));
        }
        if (length > MAX_LENGTH) {
            errors.add(new Violation(TOO_LONG, MAX_LENGTH));
        }
        String lower = password.toLowerCase(Locale.ROOT);
        if (isCommon(lower)) {
            errors.add(new Violation(COMMON));
        }
        if (username != null && username.length() >= MIN_IDENTITY_LENGTH
                && lower.contains(username.toLowerCase(Locale.ROOT))) {
            errors.add(new Violation(CONTAINS_USERNAME));
        }
        String localPart = emailLocalPart(email);
        if (localPart != null && localPart.length() >= MIN_IDENTITY_LENGTH && lower.contains(localPart)) {
            errors.add(new Violation(CONTAINS_EMAIL));
        }
        return errors;
    }

    private boolean isCommon(String lower) {
        if (common.contains(lower)) {
            return true;
        }
        String core = LEADING_FILLER.matcher(TRAILING_FILLER.matcher(lower).replaceAll("")).replaceAll("");
        return !core.isEmpty() && common.contains(core);
    }

    private static String emailLocalPart(String email) {
        if (email == null) {
            return null;
        }
        int at = email.indexOf('@');
        return (at > 0 ? email.substring(0, at) : email).trim().toLowerCase(Locale.ROOT);
    }

    private static Set<String> load() {
        try (InputStream in = PasswordPolicy.class.getResourceAsStream(LIST_RESOURCE)) {
            if (in == null) {
                throw new IllegalStateException("Missing " + LIST_RESOURCE);
            }
            Set<String> set = new HashSet<>(16_384);
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(in, StandardCharsets.UTF_8))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    String entry = line.strip().toLowerCase(Locale.ROOT);
                    if (!entry.isEmpty() && !entry.startsWith("#")) {
                        set.add(entry);
                    }
                }
            }
            return Set.copyOf(set);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
