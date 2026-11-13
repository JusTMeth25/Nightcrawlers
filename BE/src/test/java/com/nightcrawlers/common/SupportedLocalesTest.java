package com.nightcrawlers.common;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Collections;
import java.util.Locale;

import org.junit.jupiter.api.Test;

class SupportedLocalesTest {

    private static final Locale ES = Locale.of("es");

    @Test
    void picksTheFirstSupportedLanguageByQuality() {
        assertThat(SupportedLocales.fromAcceptLanguage("es-ES,es;q=0.9,en;q=0.8")).isEqualTo(ES);
        assertThat(SupportedLocales.fromAcceptLanguage("fr-FR,fr;q=0.9,en;q=0.5")).isEqualTo(Locale.ENGLISH);
        assertThat(SupportedLocales.fromAcceptLanguage("en;q=0.2,es;q=0.8")).isEqualTo(ES);
        assertThat(SupportedLocales.fromAcceptLanguage("EN-gb")).isEqualTo(Locale.ENGLISH);
    }

    @Test
    void missingUnsupportedOrMalformedHeadersAreItalian() {
        for (String header : new String[] { null, "", "  ", "fr", "*", ",,;q=x", "en;q=abc", "en;q=NaN", "xx-@@" }) {
            assertThat(SupportedLocales.fromAcceptLanguage(header)).as(String.valueOf(header))
                    .isEqualTo(Locale.ITALIAN);
        }
    }

    @Test
    void rangesWithZeroQualityAreNotAcceptable() {
        assertThat(SupportedLocales.fromAcceptLanguage("en;q=0")).isEqualTo(Locale.ITALIAN);
        assertThat(SupportedLocales.fromAcceptLanguage("en;q=0.0,es;q=0.1")).isEqualTo(ES);
    }

    @Test
    void oversizedHeadersAreItalian() {
        assertThat(SupportedLocales.fromAcceptLanguage(String.join(",", Collections.nCopies(880, "fr;q=0.5"))))
                .isEqualTo(Locale.ITALIAN);
        assertThat(SupportedLocales.fromAcceptLanguage("x".repeat(8 * 1024))).isEqualTo(Locale.ITALIAN);
    }
}
