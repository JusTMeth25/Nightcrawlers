package com.nightcrawlers.mail;

import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.Map;

import org.springframework.stereotype.Component;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;
import org.thymeleaf.exceptions.TemplateInputException;
import org.thymeleaf.templatemode.TemplateMode;
import org.thymeleaf.templateresolver.ClassLoaderTemplateResolver;

/**
 * Renders {@code mail/<name>.html} (HTML, shared layout {@code mail/layout.html}) and
 * {@code mail/<name>.txt} (plain text) with Thymeleaf. Values are escaped by Thymeleaf
 * ({@code th:text}, {@code [[...]]}), never concatenated into markup.
 */
@Component
public class MailTemplates {

    private static final Locale ITALIAN = Locale.ITALIAN;

    private final TemplateEngine html = engine(TemplateMode.HTML, ".html");
    private final TemplateEngine text = engine(TemplateMode.TEXT, ".txt");

    public RenderedMail render(String name, Map<String, ?> values) {
        Context context = new Context(ITALIAN);
        values.forEach(context::setVariable);
        try {
            return new RenderedMail(html.process(name, context), text.process(name, context));
        } catch (TemplateInputException e) {
            throw new IllegalStateException("Missing or invalid mail template " + name, e);
        }
    }

    private static TemplateEngine engine(TemplateMode mode, String suffix) {
        ClassLoaderTemplateResolver resolver = new ClassLoaderTemplateResolver();
        resolver.setPrefix("mail/");
        resolver.setSuffix(suffix);
        resolver.setTemplateMode(mode);
        resolver.setCharacterEncoding(StandardCharsets.UTF_8.name());
        resolver.setCacheable(true);
        TemplateEngine engine = new TemplateEngine();
        engine.setTemplateResolver(resolver);
        return engine;
    }
}
