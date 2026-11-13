package com.nightcrawlers.mail;

import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.Map;

import org.springframework.context.MessageSource;
import org.springframework.context.support.ResourceBundleMessageSource;
import org.springframework.stereotype.Component;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;
import org.thymeleaf.context.ITemplateContext;
import org.thymeleaf.exceptions.TemplateInputException;
import org.thymeleaf.messageresolver.AbstractMessageResolver;
import org.thymeleaf.templatemode.TemplateMode;
import org.thymeleaf.templateresolver.ClassLoaderTemplateResolver;

import com.nightcrawlers.common.SupportedLocales;

/**
 * Renders {@code mail/<name>.html} (HTML, shared layout {@code mail/layout.html}) and
 * {@code mail/<name>.txt} (plain text) with Thymeleaf, in the recipient's language. Texts come
 * from {@code mail/messages_*.properties} through {@code #{...}} expressions; the subject is
 * {@code <name>.subject} of the same bundles. Values are escaped by Thymeleaf ({@code th:text},
 * {@code [[...]]}), never concatenated into markup.
 */
@Component
public class MailTemplates {

    private final MessageSource messages = messageSource();
    private final TemplateEngine html = engine(TemplateMode.HTML, ".html", messages);
    private final TemplateEngine text = engine(TemplateMode.TEXT, ".txt", messages);

    /** Renders template {@code name} in {@code locale}; unsupported languages render in Italian. */
    public RenderedMail render(String name, Locale locale, Map<String, ?> values) {
        Context context = new Context(supported(locale));
        values.forEach(context::setVariable);
        try {
            return new RenderedMail(html.process(name, context), text.process(name, context));
        } catch (TemplateInputException e) {
            throw new IllegalStateException("Missing or invalid mail template " + name, e);
        }
    }

    /** The subject of template {@code name} in {@code locale}. */
    public String subject(String name, Locale locale) {
        return messages.getMessage(name + ".subject", null, supported(locale));
    }

    private static Locale supported(Locale locale) {
        return SupportedLocales.toLocale(SupportedLocales.codeOf(locale));
    }

    private static MessageSource messageSource() {
        ResourceBundleMessageSource source = new ResourceBundleMessageSource();
        source.setBasename("mail/messages");
        source.setDefaultEncoding(StandardCharsets.UTF_8.name());
        source.setFallbackToSystemLocale(false);
        return source;
    }

    private static TemplateEngine engine(TemplateMode mode, String suffix, MessageSource messages) {
        ClassLoaderTemplateResolver resolver = new ClassLoaderTemplateResolver();
        resolver.setPrefix("mail/");
        resolver.setSuffix(suffix);
        resolver.setTemplateMode(mode);
        resolver.setCharacterEncoding(StandardCharsets.UTF_8.name());
        resolver.setCacheable(true);
        TemplateEngine engine = new TemplateEngine();
        engine.setTemplateResolver(resolver);
        engine.setMessageResolver(new BundleMessageResolver(messages));
        return engine;
    }

    /** {@code #{key}} from the mail bundles; a missing key renders as {@code ??key_locale??}. */
    private static final class BundleMessageResolver extends AbstractMessageResolver {

        private final MessageSource messages;

        BundleMessageResolver(MessageSource messages) {
            this.messages = messages;
        }

        @Override
        public String resolveMessage(ITemplateContext context, Class<?> origin, String key,
                Object[] messageParameters) {
            return messages.getMessage(key, messageParameters, null, context.getLocale());
        }

        @Override
        public String createAbsentMessageRepresentation(ITemplateContext context, Class<?> origin, String key,
                Object[] messageParameters) {
            return "??" + key + "_" + context.getLocale() + "??";
        }
    }
}
