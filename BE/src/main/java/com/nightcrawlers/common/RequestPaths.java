package com.nightcrawlers.common;

import org.springframework.web.util.UrlPathHelper;

import jakarta.servlet.http.HttpServletRequest;

/**
 * The one place that turns a request into the path used for security decisions (CSRF, rate
 * limits, public endpoints). Uses the decoded path the router sees, not the raw URI, and
 * tells whether the raw URI was already in canonical form.
 */
public final class RequestPaths {

    private static final UrlPathHelper DECODING = new UrlPathHelper();

    static {
        DECODING.setUrlDecode(true);
        DECODING.setRemoveSemicolonContent(true);
    }

    private RequestPaths() {
    }

    /** Decoded application path, without {@code ;params} and with duplicate slashes merged. */
    public static String path(HttpServletRequest request) {
        return DECODING.getPathWithinApplication(request);
    }

    /**
     * True when the raw URI is exactly the decoded path: no percent-encoding, no {@code ;}, no
     * empty, {@code .} or {@code ..} segments and no trailing slash.
     */
    public static boolean isCanonical(HttpServletRequest request) {
        String raw = request.getRequestURI();
        String context = request.getContextPath();
        if (raw == null || !raw.startsWith(context)) {
            return false;
        }
        String rawPath = raw.substring(context.length());
        if (rawPath.isEmpty() || rawPath.indexOf('%') >= 0 || rawPath.indexOf(';') >= 0
                || rawPath.indexOf('\\') >= 0 || rawPath.contains("//")) {
            return false;
        }
        if (rawPath.length() > 1 && rawPath.endsWith("/")) {
            return false;
        }
        for (String segment : rawPath.substring(1).split("/", -1)) {
            if (segment.equals(".") || segment.equals("..")) {
                return false;
            }
        }
        return rawPath.equals(path(request));
    }
}
