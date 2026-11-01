package com.nightcrawlers.mail;

/** An email to deliver once the current transaction has committed. */
public record MailMessage(String to, String subject, RenderedMail body) {

    @Override
    public String toString() {
        return "MailMessage[subject=" + subject + "]";
    }
}
