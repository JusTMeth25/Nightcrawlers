package com.nightcrawlers.common;

import java.io.IOException;

import org.springframework.http.HttpStatus;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Rejects API requests whose URI is not in canonical form (for example {@code /api/auth/logi%6E}),
 * so every later filter can rely on one spelling of each path. The client never needs those forms.
 */
public class CanonicalPathFilter extends OncePerRequestFilter {

    private final ProblemResponses problems;

    public CanonicalPathFilter(ProblemResponses problems) {
        this.problems = problems;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        if (RequestPaths.path(request).startsWith("/api/") && !RequestPaths.isCanonical(request)) {
            problems.write(request, response, HttpStatus.BAD_REQUEST, "error.invalidPath");
            return;
        }
        chain.doFilter(request, response);
    }
}
