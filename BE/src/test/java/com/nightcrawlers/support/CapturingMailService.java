package com.nightcrawlers.support;

import java.util.List;
import java.util.Optional;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import com.nightcrawlers.mail.MailService;

/** Keeps sent emails in memory instead of talking to SMTP. */
public class CapturingMailService implements MailService {

    private static final Pattern TOKEN = Pattern.compile("token=([A-Za-z0-9_-]+)");

    public record Mail(String to, String subject, String html) {

        public Optional<String> token() {
            Matcher m = TOKEN.matcher(html);
            return m.find() ? Optional.of(m.group(1)) : Optional.empty();
        }
    }

    private final List<Mail> sent = new CopyOnWriteArrayList<>();

    @Override
    public void send(String to, String subject, String html) {
        sent.add(new Mail(to, subject, html));
    }

    public List<Mail> to(String address) {
        return sent.stream().filter(m -> m.to().equals(address)).toList();
    }

    public Mail lastTo(String address) {
        List<Mail> mails = to(address);
        if (mails.isEmpty()) {
            throw new AssertionError("No email sent to " + address);
        }
        return mails.getLast();
    }
}
