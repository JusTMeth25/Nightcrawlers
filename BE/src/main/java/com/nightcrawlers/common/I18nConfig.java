package com.nightcrawlers.common;

import java.util.Locale;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.web.servlet.DispatcherServlet;
import org.springframework.web.servlet.LocaleResolver;
import org.springframework.web.servlet.i18n.AcceptHeaderLocaleResolver;

import jakarta.servlet.http.HttpServletRequest;

/** Request language from {@code Accept-Language}: it, en or es, Italian otherwise. */
@Configuration(proxyBeanMethods = false)
public class I18nConfig {

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
