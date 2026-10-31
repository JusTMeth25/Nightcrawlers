package com.nightcrawlers.auth;

import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;
import org.springframework.security.oauth2.jwt.JwtDecoder;

import com.nightcrawlers.common.ProblemResponses;

import tools.jackson.databind.json.JsonMapper;

@Configuration(proxyBeanMethods = false)
public class RateLimitConfig {

    /** After ForwardedHeaderFilter (highest precedence), before Spring Security. */
    static final int ORDER = Ordered.HIGHEST_PRECEDENCE + 10;

    @Bean
    FilterRegistrationBean<RateLimitFilter> rateLimitFilter(RateLimitProperties limits, ProblemResponses problems,
            JsonMapper json, JwtDecoder jwtDecoder) {
        FilterRegistrationBean<RateLimitFilter> registration = new FilterRegistrationBean<>(
                new RateLimitFilter(limits, problems, json, jwtDecoder));
        registration.setOrder(ORDER);
        registration.addUrlPatterns("/api/auth/*");
        return registration;
    }
}
