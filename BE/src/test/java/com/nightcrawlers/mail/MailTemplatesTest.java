package com.nightcrawlers.mail;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.Locale;
import java.util.Map;

import org.junit.jupiter.api.Test;

class MailTemplatesTest {

    private static final String LINK = "https://playnightcrawlers.duckdns.org/verify-email?token=abc_DEF-123";
    private static final Locale IT = Locale.ITALIAN;
    private static final Locale EN = Locale.ENGLISH;
    private static final Locale ES = Locale.of("es");
    private static final String[] TEMPLATES = { "verify-email", "reset-password", "already-registered" };

    private final MailTemplates templates = new MailTemplates();

    private RenderedMail render(String name, Locale locale) {
        return templates.render(name, locale, Map.of("username", "Aki", "link", LINK));
    }

    @Test
    void rendersHtmlAndTextWithTheGameLayout() {
        RenderedMail mail = render("verify-email", IT);

        assertThat(mail.html())
                .contains("NIGHTCRAWLERS")
                .contains(">Aki</strong>")
                .contains("href=\"" + LINK + "\"")
                .contains("Gioco fan non ufficiale e non commerciale")
                .contains("<html lang=\"it\"")
                .doesNotContainPattern("\\sth:[a-z]+=|xmlns:th");
        assertThat(mail.text())
                .contains("NIGHTCRAWLERS")
                .contains("Ciao Aki")
                .contains(LINK)
                .doesNotContain("<");
    }

    @Test
    void verifyEmailIsRenderedInTheGivenLanguage() {
        RenderedMail en = render("verify-email", EN);
        assertThat(en.html()).contains("Confirm your email").contains("<html lang=\"en\"")
                .contains("Unofficial, non-commercial fan game").doesNotContain("Conferma");
        assertThat(en.text()).contains("Confirm your email").contains("Hi Aki,")
                .contains("Your profile is almost ready.").doesNotContain("Ciao");
        assertThat(en.html()).contains("Your profile is almost ready.");

        RenderedMail es = render("verify-email", ES);
        assertThat(es.html()).contains("Confirma tu correo").contains("<html lang=\"es\"")
                .contains("Juego fan no oficial y sin fines comerciales.")
                .contains("No afiliado a CD Projekt ni a Studio Trigger.");
        assertThat(es.text()).contains("Confirma tu correo").contains("Hola Aki,")
                .contains("Tu perfil está casi listo.").contains("No afiliado a CD Projekt ni a Studio Trigger.");
        assertThat(render("reset-password", EN).text()).contains("We received a request")
                .contains("all open sessions will be signed out for security.");
        assertThat(render("already-registered", ES).text()).contains("Alguien ha intentado");
    }

    @Test
    void subjectsAreLocalized() {
        assertThat(templates.subject("verify-email", IT)).isEqualTo("Conferma il tuo indirizzo email - Nightcrawlers");
        assertThat(templates.subject("verify-email", EN)).isEqualTo("Confirm your email address - Nightcrawlers");
        assertThat(templates.subject("verify-email", ES)).isEqualTo("Confirma tu dirección de correo - Nightcrawlers");
        assertThat(templates.subject("reset-password", IT)).isEqualTo("Reimposta la password - Nightcrawlers");
        assertThat(templates.subject("reset-password", EN)).isEqualTo("Reset your password - Nightcrawlers");
        assertThat(templates.subject("already-registered", ES)).isEqualTo("Intento de registro - Nightcrawlers");
    }

    @Test
    void unsupportedLanguageFallsBackToItalian() {
        assertThat(render("verify-email", Locale.FRENCH).text()).contains("Ciao Aki");
        assertThat(templates.subject("verify-email", Locale.FRENCH))
                .isEqualTo("Conferma il tuo indirizzo email - Nightcrawlers");
    }

    @Test
    void escapesUserControlledValuesInHtml() {
        RenderedMail mail = templates.render("verify-email", EN,
                Map.of("username", "<script>alert(1)</script>", "link", LINK));

        assertThat(mail.html()).doesNotContain("<script>").contains("&lt;script&gt;");
    }

    @Test
    void rendersEveryTemplateInEveryLanguageWithoutMissingKeys() {
        for (String name : TEMPLATES) {
            for (Locale locale : new Locale[] { IT, EN, ES }) {
                RenderedMail mail = render(name, locale);
                String as = name + " " + locale;
                assertThat(mail.html()).as(as).contains(LINK).contains("NIGHTCRAWLERS").doesNotContain("??");
                assertThat(mail.text()).as(as).contains(LINK).doesNotContain("??");
                assertThat(templates.subject(name, locale)).as(as).endsWith(" - Nightcrawlers");
            }
        }
    }

    @Test
    void failsOnUnknownTemplate() {
        assertThatThrownBy(() -> templates.render("nope", IT, Map.of()))
                .hasMessageContaining("nope");
    }
}
