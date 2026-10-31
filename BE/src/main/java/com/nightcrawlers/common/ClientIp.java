package com.nightcrawlers.common;

import jakarta.servlet.http.HttpServletRequest;

/**
 * Client address. {@code server.forward-headers-strategy=framework} has already replaced the
 * remote address with the one from the trusted proxy headers.
 */
public final class ClientIp {

    private ClientIp() {
    }

    public static String resolve(HttpServletRequest request) {
        return request.getRemoteAddr();
    }
}
