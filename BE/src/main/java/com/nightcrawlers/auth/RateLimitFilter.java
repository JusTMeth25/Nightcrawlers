package com.nightcrawlers.auth;

import java.io.ByteArrayInputStream;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.SequenceInputStream;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.web.filter.OncePerRequestFilter;

import com.nightcrawlers.auth.RateLimitProperties.Limit;
import com.nightcrawlers.common.ClientIp;
import com.nightcrawlers.common.ProblemResponses;
import com.nightcrawlers.user.Emails;

import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.ConsumptionProbe;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ReadListener;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletInputStream;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * In-memory token buckets (Bucket4j) on the public auth endpoints, keyed by endpoint + client IP
 * and, where the request names an account, endpoint + normalized account. Runs after the
 * forwarded-headers filter, so the IP is the one reported by the trusted reverse proxy.
 */
public class RateLimitFilter extends OncePerRequestFilter {

    static final int MAX_INSPECTED_BODY = 16 * 1024;
    private static final Duration IDLE_EVICTION = Duration.ofHours(2);
    private static final int CLEANUP_EVERY = 1_000;

    private record Entry(Bucket bucket, AtomicLong lastSeen) {
    }

    private final RateLimitProperties limits;
    private final ProblemResponses problems;
    private final JsonMapper json;
    private final JwtDecoder jwtDecoder;
    private final Map<String, Entry> buckets = new ConcurrentHashMap<>();
    private final AtomicLong requests = new AtomicLong();

    public RateLimitFilter(RateLimitProperties limits, ProblemResponses problems, JsonMapper json,
            JwtDecoder jwtDecoder) {
        this.limits = limits;
        this.problems = problems;
        this.json = json;
        this.jwtDecoder = jwtDecoder;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !"POST".equals(request.getMethod()) || !request.getRequestURI().startsWith("/api/auth/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String path = request.getRequestURI();
        String ip = ClientIp.resolve(request);
        HttpServletRequest forward = request;
        List<String[]> checks = new ArrayList<>(); // {key, limitName}
        switch (path) {
            case "/api/auth/register" -> checks.add(new String[] { "register|ip|" + ip, "register" });
            case "/api/auth/login" -> {
                CachedBodyRequest cached = new CachedBodyRequest(request);
                forward = cached;
                checks.add(new String[] { "login|ip|" + ip, "loginIp" });
                String login = cached.field(json, "login");
                if (login != null) {
                    checks.add(new String[] { "login|acct|" + normalizeLogin(login), "loginAccount" });
                }
            }
            case "/api/auth/refresh" -> checks.add(new String[] { "refresh|ip|" + ip, "refreshIp" });
            case "/api/auth/forgot-password" -> {
                CachedBodyRequest cached = new CachedBodyRequest(request);
                forward = cached;
                checks.add(new String[] { "forgot|ip|" + ip, "forgotIp" });
                String email = cached.field(json, "email");
                if (email != null) {
                    checks.add(new String[] { "forgot|acct|" + Emails.normalize(email), "forgotAccount" });
                }
            }
            case "/api/auth/resend-verification" -> {
                checks.add(new String[] { "resend|ip|" + ip, "forgotIp" });
                String subject = bearerSubject(request);
                if (subject != null) {
                    checks.add(new String[] { "resend|acct|" + subject, "forgotAccount" });
                }
            }
            case "/api/auth/reset-password" -> checks.add(new String[] { "reset|ip|" + ip, "resetIp" });
            default -> {
                // not limited
            }
        }
        for (String[] check : checks) {
            ConsumptionProbe probe = bucket(check[0], limit(check[1])).tryConsumeAndReturnRemaining(1);
            if (!probe.isConsumed()) {
                long seconds = Math.max(1, (probe.getNanosToWaitForRefill() + 999_999_999L) / 1_000_000_000L);
                response.setHeader(HttpHeaders.RETRY_AFTER, Long.toString(seconds));
                problems.write(request, response, HttpStatus.TOO_MANY_REQUESTS, "Troppe richieste",
                        "Hai fatto troppi tentativi. Riprova tra " + seconds + " secondi.");
                return;
            }
        }
        chain.doFilter(forward, response);
    }

    private Limit limit(String name) {
        return switch (name) {
            case "register" -> limits.register();
            case "loginIp" -> limits.loginIp();
            case "loginAccount" -> limits.loginAccount();
            case "refreshIp" -> limits.refreshIp();
            case "forgotAccount" -> limits.forgotAccount();
            case "forgotIp" -> limits.forgotIp();
            case "resetIp" -> limits.resetIp();
            default -> throw new IllegalArgumentException(name);
        };
    }

    private Bucket bucket(String key, Limit limit) {
        long now = System.nanoTime();
        if (requests.incrementAndGet() % CLEANUP_EVERY == 0) {
            long idle = IDLE_EVICTION.toNanos();
            buckets.values().removeIf(e -> now - e.lastSeen().get() > idle);
        }
        Entry entry = buckets.computeIfAbsent(key, k -> new Entry(Bucket.builder()
                .addLimit(Bandwidth.builder().capacity(limit.capacity())
                        .refillGreedy(limit.capacity(), limit.period()).build())
                .build(), new AtomicLong(now)));
        entry.lastSeen().set(now);
        return entry.bucket();
    }

    /** Usernames are case-insensitive and emails are normalized, so both map to one key. */
    static String normalizeLogin(String login) {
        return login.trim().toLowerCase(Locale.ROOT);
    }

    private String bearerSubject(HttpServletRequest request) {
        String header = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (header == null || !header.regionMatches(true, 0, "Bearer ", 0, 7)) {
            return null;
        }
        try {
            return jwtDecoder.decode(header.substring(7).trim()).getSubject();
        } catch (RuntimeException e) {
            return null; // the security chain answers 401
        }
    }

    /** Reads the start of the body to find the account and replays the whole body downstream. */
    static final class CachedBodyRequest extends HttpServletRequestWrapper {

        private final byte[] head;
        private final boolean complete;
        private boolean consumed;

        CachedBodyRequest(HttpServletRequest request) throws IOException {
            super(request);
            byte[] read = request.getInputStream().readNBytes(MAX_INSPECTED_BODY + 1);
            this.complete = read.length <= MAX_INSPECTED_BODY;
            this.head = read;
        }

        String field(JsonMapper json, String name) {
            if (!complete || head.length == 0) {
                return null;
            }
            try {
                JsonNode value = json.readTree(head).get(name);
                return value != null && value.isString() && !value.asString().isBlank() ? value.asString() : null;
            } catch (RuntimeException e) {
                return null; // malformed JSON: the controller answers 400
            }
        }

        @Override
        public ServletInputStream getInputStream() throws IOException {
            if (consumed) {
                throw new IllegalStateException("Body already read");
            }
            consumed = true;
            InputStream body = complete ? new ByteArrayInputStream(head)
                    : new SequenceInputStream(new ByteArrayInputStream(head), super.getInputStream());
            return new ServletInputStream() {
                private boolean finished;

                @Override
                public int read() throws IOException {
                    int b = body.read();
                    finished = b < 0;
                    return b;
                }

                @Override
                public int read(byte[] buffer, int off, int len) throws IOException {
                    int n = body.read(buffer, off, len);
                    finished = n < 0;
                    return n;
                }

                @Override
                public boolean isFinished() {
                    return finished;
                }

                @Override
                public boolean isReady() {
                    return true;
                }

                @Override
                public void setReadListener(ReadListener listener) {
                    throw new UnsupportedOperationException();
                }
            };
        }

        @Override
        public BufferedReader getReader() throws IOException {
            String encoding = getCharacterEncoding();
            return new BufferedReader(new InputStreamReader(getInputStream(),
                    encoding != null ? java.nio.charset.Charset.forName(encoding) : StandardCharsets.UTF_8));
        }
    }
}
