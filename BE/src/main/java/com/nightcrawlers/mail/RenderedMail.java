package com.nightcrawlers.mail;

/** An email body in both forms: HTML for mail clients, plain text as the multipart alternative. */
public record RenderedMail(String html, String text) {

    @Override
    public String toString() {
        return "RenderedMail[html=" + html.length() + " chars, text=" + text.length() + " chars]";
    }
}
