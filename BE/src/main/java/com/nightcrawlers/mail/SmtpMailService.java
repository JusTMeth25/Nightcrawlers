package com.nightcrawlers.mail;

import java.nio.charset.StandardCharsets;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.mail.MailException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import com.nightcrawlers.common.AppProperties;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;

/**
 * Sends HTML email through SMTP (Brevo in production). Delivery failures are logged, not
 * propagated: the caller's answer must not depend on the mail relay (no enumeration, no 500).
 */
@Service
public class SmtpMailService implements MailService {

    private static final Logger log = LoggerFactory.getLogger(SmtpMailService.class);

    private final JavaMailSender sender;
    private final String from;

    public SmtpMailService(JavaMailSender sender, AppProperties props) {
        this.sender = sender;
        this.from = props.mail().from();
    }

    @Override
    public void send(String to, String subject, String html) {
        try {
            MimeMessage message = sender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, false, StandardCharsets.UTF_8.name());
            helper.setFrom(from);
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(html, true);
            sender.send(message);
        } catch (MessagingException | MailException e) {
            // Exception class only: SMTP messages often echo the recipient address.
            log.warn("Email delivery failed: {}", e.getClass().getSimpleName());
        }
    }
}
