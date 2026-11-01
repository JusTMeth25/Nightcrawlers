package com.nightcrawlers.mail;

public interface MailService {

    void send(String to, String subject, RenderedMail body);
}
