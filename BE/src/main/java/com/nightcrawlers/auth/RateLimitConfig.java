package com.nightcrawlers.auth;

import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;
import org.springframework.security.oauth2.jwt.JwtDecoder;

import com.nightcrawlers.common.CanonicalPathFilter;
import com.nightcrawlers.common.ProblemResponses;

import tools.jackson.databind.json.JsonMapper;

@Configuration(proxyBeanMethods = false)
public class RateLimitConfig {

    /** After ForwardedHeaderFilter (highest precedence), before Spring Security. */
    static final int ORDER = Ordered.HIGHEST_PRECEDENCE + 10;

    static final int CANONICAL_PATH_ORDER = Ordered.HIGHEST_PRECEDENCE + 5;

    /** Before rate limits, CSRF and Spring Security: they all assume canonical paths. */
    @Bean
    FilterRegistrationBean<CanonicalPathFilter> canonicalPathFilter(ProblemResponses problems) {
        FilterRegistrationBean<CanonicalPathFilter> registration = new FilterRegistrationBean<>(
                new CanonicalPathFilter(problems));
        registration.setOrder(CANONICAL_PATH_ORDER);
        registration.addUrlPatterns("/*");
        return registration;
    }

    @Bean
    FilterRegistrationBean<RateLimitFilter> rateLimitFilter(RateLimitProperties limits, ProblemResponses problems,
            JsonMapper json, JwtDecoder jwtDecoder) {
        FilterRegistrationBean<RateLimitFilter> registration = new FilterRegistrationBean<>(
                new RateLimitFilter(limits, problems, json, jwtDecoder));
        registration.setOrder(ORDER);
        registration.addUrlPatterns("/*");
        return registration;
    }
}
