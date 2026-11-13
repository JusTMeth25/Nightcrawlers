package com.nightcrawlers.common;

import java.util.Locale;

import org.springframework.context.MessageSource;
import org.springframework.context.i18n.LocaleContextHolder;
import org.springframework.stereotype.Component;

/** User-facing texts from {@code i18n/messages_*.properties}. */
@Component
public class Messages {

    private final MessageSource source;

    public Messages(MessageSource source) {
        this.source = source;
    }

    /** The text in {@code locale}; the key itself when it is missing (never an exception). */
    public String get(String key, Locale locale, Object... args) {
        return source.getMessage(key, args, key, locale);
    }

    /** The text in the language of the current request. */
    public String get(String key, Object... args) {
        return get(key, LocaleContextHolder.getLocale(), args);
    }

    /** The text in {@code locale}, or {@code null} when the key does not exist. */
    public String optional(String key, Locale locale, Object... args) {
        return source.getMessage(key, args, null, locale);
    }
}
