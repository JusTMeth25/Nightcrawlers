package com.nightcrawlers.common;

import java.util.List;
import java.util.Locale;

/** The languages of the API messages and emails: Italian (default), English, Spanish. */
public final class SupportedLocales {

    public static final String DEFAULT_CODE = "it";
    public static final List<String> CODES = List.of("it", "en", "es");
    public static final Locale DEFAULT = Locale.ITALIAN;
    public static final List<Locale> LOCALES = List.of(Locale.ITALIAN, Locale.ENGLISH, Locale.of("es"));

    private SupportedLocales() {
    }

    public static boolean isSupported(String code) {
        return code != null && CODES.contains(code);
    }

    /** The supported language code of {@code locale}, or {@code null} when unsupported. */
    public static String codeOf(Locale locale) {
        if (locale == null) {
            return null;
        }
        String language = locale.getLanguage();
        return isSupported(language) ? language : null;
    }

    /** The {@link Locale} of a supported code; Italian for anything else. */
    public static Locale toLocale(String code) {
        return isSupported(code) ? Locale.of(code) : DEFAULT;
    }

    /**
     * The first supported language of an {@code Accept-Language} header, by quality; Italian when
     * the header is missing, malformed or lists no supported language. Never throws.
     */
    public static Locale fromAcceptLanguage(String header) {
        if (header == null || header.isBlank()) {
            return DEFAULT;
        }
        try {
            for (Locale.LanguageRange range : Locale.LanguageRange.parse(header)) {
                String tag = range.getRange();
                int dash = tag.indexOf('-');
                String language = (dash < 0 ? tag : tag.substring(0, dash)).toLowerCase(Locale.ROOT);
                if (isSupported(language)) {
                    return Locale.of(language);
                }
            }
        } catch (IllegalArgumentException malformed) {
            return DEFAULT;
        }
        return DEFAULT;
    }
}
