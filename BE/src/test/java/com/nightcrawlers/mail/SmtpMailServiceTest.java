package com.nightcrawlers.mail;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Duration;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.mail.MailSendException;
import org.springframework.mail.javamail.JavaMailSender;

import com.nightcrawlers.common.AppProperties;

import jakarta.mail.Session;
import jakarta.mail.internet.MimeMessage;

@ExtendWith(OutputCaptureExtension.class)
class SmtpMailServiceTest {

    static final String EMAIL = "mario.rossi@mail.it";

    final JavaMailSender sender = mock(JavaMailSender.class);
    final SmtpMailService service = new SmtpMailService(sender, new AppProperties(
            new AppProperties.Jwt("x".repeat(40), Duration.ofMinutes(15)),
            new AppProperties.Refresh(Duration.ofDays(30), Duration.ofDays(90), Duration.ofSeconds(20)),
            new AppProperties.Cors(List.of("http://x")), new AppProperties.Mail("Nightcrawlers <no-reply@x.it>"),
            "http://x", "salt", new AppProperties.Cookies(true)));

    @Test
    void sendsMultipartAlternativeWithTextAndHtml() throws Exception {
        MimeMessage message = new MimeMessage((Session) null);
        when(sender.createMimeMessage()).thenReturn(message);

        service.send(EMAIL, "Oggetto", new RenderedMail("<p>ciao html</p>", "ciao testo"));

        verify(sender).send(message);
        message.saveChanges();
        java.io.ByteArrayOutputStream raw = new java.io.ByteArrayOutputStream();
        message.writeTo(raw);
        String mime = raw.toString(java.nio.charset.StandardCharsets.UTF_8);
        assertThat(mime)
                .contains("multipart/alternative")
                .contains("text/plain").contains("ciao testo")
                .contains("text/html").contains("ciao html");
        assertThat(mime.indexOf("text/plain")).isLessThan(mime.indexOf("text/html"));
    }

    @Test
    void deliveryFailureIsLoggedWithoutTheRecipient(CapturedOutput output) {
        when(sender.createMimeMessage()).thenReturn(new MimeMessage((Session) null));
        doThrow(new MailSendException("Failed messages: invalid address " + EMAIL)).when(sender).send(any(MimeMessage.class));

        service.send(EMAIL, "Oggetto", new RenderedMail("<p>ciao</p>", "ciao"));

        assertThat(output).contains("MailSendException").doesNotContain(EMAIL);
    }
}
