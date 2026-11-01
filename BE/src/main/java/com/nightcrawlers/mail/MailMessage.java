package com.nightcrawlers.mail;

/** An email to deliver once the current transaction has committed. */
public record MailMessage(String to, String subject, String html) {

    @Override
    public String toString() {
        return "MailMessage[subject=" + subject + "]";
    }
}
