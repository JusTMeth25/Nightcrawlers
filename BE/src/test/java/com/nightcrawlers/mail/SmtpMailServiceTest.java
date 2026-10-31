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
            new AppProperties.Refresh(Duration.ofDays(30)),
            new AppProperties.Cors(List.of("http://x")), new AppProperties.Mail("Nightcrawlers <no-reply@x.it>"),
            "http://x", "salt", new AppProperties.Cookies(true)));

    @Test
    void sendsHtmlMail() {
        MimeMessage message = new MimeMessage((Session) null);
        when(sender.createMimeMessage()).thenReturn(message);

        service.send(EMAIL, "Oggetto", "<p>ciao</p>");

        verify(sender).send(message);
    }

    @Test
    void deliveryFailureIsLoggedWithoutTheRecipient(CapturedOutput output) {
        when(sender.createMimeMessage()).thenReturn(new MimeMessage((Session) null));
        doThrow(new MailSendException("Failed messages: invalid address " + EMAIL)).when(sender).send(any(MimeMessage.class));

        service.send(EMAIL, "Oggetto", "<p>ciao</p>");

        assertThat(output).contains("MailSendException").doesNotContain(EMAIL);
    }
}
