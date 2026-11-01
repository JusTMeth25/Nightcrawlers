package com.nightcrawlers.mail;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Component;

/**
 * Entry point for business code: queues an email instead of sending it. Delivery happens after
 * commit on a background executor, so SMTP latency never shows in response times (no account
 * enumeration by timing) and a rolled-back transaction sends nothing.
 */
@Component
public class MailOutbox {

    private final ApplicationEventPublisher events;

    public MailOutbox(ApplicationEventPublisher events) {
        this.events = events;
    }

    public void queue(String to, String subject, RenderedMail body) {
        events.publishEvent(new MailMessage(to, subject, body));
    }
}
