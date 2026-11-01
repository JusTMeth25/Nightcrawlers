package com.nightcrawlers.mail;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.stereotype.Component;
import org.springframework.web.util.HtmlUtils;

/** Loads {@code mail/templates/<name>.html} and replaces {@code {{key}}} with HTML-escaped values. */
@Component
public class MailTemplates {

    private final Map<String, String> cache = new ConcurrentHashMap<>();

    public String render(String name, Map<String, String> values) {
        String html = cache.computeIfAbsent(name, MailTemplates::load);
        for (Map.Entry<String, String> e : values.entrySet()) {
            html = html.replace("{{" + e.getKey() + "}}", HtmlUtils.htmlEscape(e.getValue(), "UTF-8"));
        }
        return html;
    }

    private static String load(String name) {
        String path = "/mail/templates/" + name + ".html";
        try (InputStream in = MailTemplates.class.getResourceAsStream(path)) {
            if (in == null) {
                throw new IllegalStateException("Missing mail template " + path);
            }
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
