package com.nightcrawlers.user;

import java.util.Locale;

public final class Emails {

    private Emails() {
    }

    /** Trim and lower case: the only form stored and compared. */
    public static String normalize(String email) {
        return email == null ? null : email.trim().toLowerCase(Locale.ROOT);
    }
}
