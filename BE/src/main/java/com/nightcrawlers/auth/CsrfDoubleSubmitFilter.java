package com.nightcrawlers.auth;

import java.io.IOException;
import java.util.Set;

import org.springframework.http.HttpStatus;
import org.springframework.web.filter.OncePerRequestFilter;

import com.nightcrawlers.common.ProblemResponses;
import com.nightcrawlers.common.RequestPaths;
import com.nightcrawlers.common.SecureTokens;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Double-submit CSRF check for the only endpoints authenticated by cookie: the
 * {@code X-CSRF-Token} header must equal the {@code XSRF-TOKEN} cookie (constant-time compare).
 * A cross-site page can make the browser send the cookie but cannot read it to set the header.
 */
public class CsrfDoubleSubmitFilter extends OncePerRequestFilter {

    static final Set<String> PROTECTED = Set.of("/api/auth/refresh", "/api/auth/logout");

    private final ProblemResponses problems;

    public CsrfDoubleSubmitFilter(ProblemResponses problems) {
        this.problems = problems;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !("POST".equals(request.getMethod()) && PROTECTED.contains(RequestPaths.path(request)));
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String header = request.getHeader(AuthCookies.CSRF_HEADER);
        String cookie = cookie(request, AuthCookies.CSRF);
        if (header == null || header.isEmpty() || !SecureTokens.constantTimeEquals(header, cookie)) {
            problems.write(request, response, HttpStatus.FORBIDDEN, "error.csrf");
            return;
        }
        chain.doFilter(request, response);
    }

    static String cookie(HttpServletRequest request, String name) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) {
            return null;
        }
        for (Cookie c : cookies) {
            if (name.equals(c.getName())) {
                return c.getValue();
            }
        }
        return null;
    }
}
