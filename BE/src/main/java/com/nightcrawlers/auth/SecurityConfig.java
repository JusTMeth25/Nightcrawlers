package com.nightcrawlers.auth;

import java.util.List;
import java.util.Set;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.server.resource.web.BearerTokenResolver;
import org.springframework.security.oauth2.server.resource.web.DefaultBearerTokenResolver;
import org.springframework.security.oauth2.server.resource.web.authentication.BearerTokenAuthenticationFilter;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import com.nightcrawlers.common.AppProperties;
import com.nightcrawlers.common.ProblemResponses;

@Configuration(proxyBeanMethods = false)
public class SecurityConfig {

    /**
     * Endpoints that never need an access token. A stale Bearer header sent to them is ignored
     * instead of answering 401 (the client may still attach an expired token to /auth/refresh).
     */
    static final Set<String> PUBLIC_AUTH = Set.of(
            "/api/auth/register", "/api/auth/verify-email", "/api/auth/login", "/api/auth/refresh",
            "/api/auth/logout", "/api/auth/forgot-password", "/api/auth/reset-password");

    @Bean
    SecurityFilterChain apiSecurity(HttpSecurity http, ProblemResponses problems, JwtDecoder jwtDecoder)
            throws Exception {
        AuthenticationEntryPoint unauthorized = (req, res, ex) -> {
            res.setHeader(HttpHeaders.WWW_AUTHENTICATE, "Bearer");
            problems.write(req, res, HttpStatus.UNAUTHORIZED, "Non autenticato", "Accesso richiesto o sessione scaduta.");
        };
        http
                // Bearer tokens are not sent automatically by browsers; the two cookie endpoints
                // use a double-submit check instead of Spring's session-based CSRF.
                .csrf(csrf -> csrf.disable())
                .cors(Customizer.withDefaults())
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .requestCache(rc -> rc.disable())
                .httpBasic(b -> b.disable())
                .formLogin(f -> f.disable())
                .logout(l -> l.disable())
                // Headers are written by SecurityHeadersFilter on every response.
                .headers(h -> h.disable())
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/actuator/health", "/actuator/health/**", "/error").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/auth/resend-verification", "/api/auth/logout-all")
                        .authenticated()
                        .requestMatchers("/api/auth/**").permitAll()
                        .requestMatchers("/api/**").authenticated()
                        .anyRequest().denyAll())
                .addFilterBefore(new CsrfDoubleSubmitFilter(problems), BearerTokenAuthenticationFilter.class)
                .oauth2ResourceServer(o -> o
                        .jwt(j -> j.decoder(jwtDecoder))
                        .bearerTokenResolver(bearerTokenResolver())
                        .authenticationEntryPoint(unauthorized))
                .exceptionHandling(e -> e
                        .authenticationEntryPoint(unauthorized)
                        .accessDeniedHandler((req, res, ex) -> problems.write(req, res, HttpStatus.FORBIDDEN,
                                "Accesso negato", null)));
        return http.build();
    }

    @Bean
    JwtDecoder jwtDecoder(JwtService jwtService) {
        return jwtService.decoder();
    }

    static BearerTokenResolver bearerTokenResolver() {
        DefaultBearerTokenResolver delegate = new DefaultBearerTokenResolver();
        return request -> PUBLIC_AUTH.contains(request.getRequestURI()) ? null : delegate.resolve(request);
    }

    @Bean
    CorsConfigurationSource corsConfigurationSource(AppProperties props) {
        CorsConfiguration cors = new CorsConfiguration();
        cors.setAllowedOrigins(props.cors().allowedOrigins());
        cors.setAllowedMethods(List.of("GET", "POST", "DELETE", "OPTIONS"));
        cors.setAllowedHeaders(List.of("Authorization", "Content-Type", "X-CSRF-Token"));
        cors.setAllowCredentials(true);
        cors.setMaxAge(3600L);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", cors);
        return source;
    }
}
