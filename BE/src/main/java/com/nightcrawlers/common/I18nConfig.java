package com.nightcrawlers.common;

import java.nio.charset.StandardCharsets;
import java.util.Locale;

import org.springframework.context.MessageSource;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.support.AbstractApplicationContext;
import org.springframework.context.support.ResourceBundleMessageSource;
import org.springframework.http.HttpHeaders;
import org.springframework.web.servlet.DispatcherServlet;
import org.springframework.web.servlet.LocaleResolver;
import org.springframework.web.servlet.i18n.AcceptHeaderLocaleResolver;

import jakarta.servlet.http.HttpServletRequest;

/** Message bundles and the request language from {@code Accept-Language}: it, en or es, Italian otherwise. */
@Configuration(proxyBeanMethods = false)
public class I18nConfig {

    /**
     * {@code i18n/messages_*.properties}, UTF-8. Missing keys fall back to the Italian default
     * bundle, never to the JVM locale. Every message goes through MessageFormat, so the bundles
     * write {@code ''} for an apostrophe whether or not the message has arguments. Bean
     * Validation resolves {@code {key}} messages from here too.
     */
    @Bean(name = AbstractApplicationContext.MESSAGE_SOURCE_BEAN_NAME)
    public MessageSource messageSource() {
        ResourceBundleMessageSource source = new ResourceBundleMessageSource();
        source.setBasename("i18n/messages");
        source.setDefaultEncoding(StandardCharsets.UTF_8.name());
        source.setFallbackToSystemLocale(false);
        source.setAlwaysUseMessageFormat(true);
        return source;
    }

    @Bean(name = DispatcherServlet.LOCALE_RESOLVER_BEAN_NAME)
    LocaleResolver localeResolver() {
        return new SupportedLocaleResolver();
    }

    /**
     * Parses the header itself: the servlet container falls back to the JVM default locale for a
     * malformed header, which could be English on a server and must not be.
     */
    static class SupportedLocaleResolver extends AcceptHeaderLocaleResolver {

        SupportedLocaleResolver() {
            setSupportedLocales(SupportedLocales.LOCALES);
            setDefaultLocale(SupportedLocales.DEFAULT);
        }

        @Override
        public Locale resolveLocale(HttpServletRequest request) {
            return SupportedLocales.fromAcceptLanguage(request.getHeader(HttpHeaders.ACCEPT_LANGUAGE));
        }
    }
}
