package com.nightcrawlers.mail;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.Map;

import org.junit.jupiter.api.Test;

class MailTemplatesTest {

    private static final String LINK = "https://playnightcrawlers.duckdns.org/verify-email?token=abc_DEF-123";

    private final MailTemplates templates = new MailTemplates();

    @Test
    void rendersHtmlAndTextWithTheGameLayout() {
        RenderedMail mail = templates.render("verify-email", Map.of("username", "Aki", "link", LINK));

        assertThat(mail.html())
                .contains("NIGHTCRAWLERS")
                .contains(">Aki</strong>")
                .contains("href=\"" + LINK + "\"")
                .contains("Gioco fan non ufficiale e non commerciale")
                .doesNotContainPattern("\\sth:[a-z]+=|xmlns:th");
        assertThat(mail.text())
                .contains("NIGHTCRAWLERS")
                .contains("Ciao Aki")
                .contains(LINK)
                .doesNotContain("<");
    }

    @Test
    void escapesUserControlledValuesInHtml() {
        RenderedMail mail = templates.render("verify-email",
                Map.of("username", "<script>alert(1)</script>", "link", LINK));

        assertThat(mail.html()).doesNotContain("<script>").contains("&lt;script&gt;");
    }

    @Test
    void rendersEveryTemplateUsedByTheApplication() {
        for (String name : new String[] {"verify-email", "reset-password", "already-registered"}) {
            RenderedMail mail = templates.render(name, Map.of("username", "Aki", "link", LINK));
            assertThat(mail.html()).as(name).contains(LINK).contains("NIGHTCRAWLERS");
            assertThat(mail.text()).as(name).contains(LINK);
        }
    }

    @Test
    void failsOnUnknownTemplate() {
        assertThatThrownBy(() -> templates.render("nope", Map.of()))
                .hasMessageContaining("nope");
    }
}
