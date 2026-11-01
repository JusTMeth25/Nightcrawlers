package com.nightcrawlers.common;

import jakarta.servlet.http.HttpServletRequest;

/**
 * Client address. Tomcat's RemoteIpValve ({@code server.forward-headers-strategy=native}) has
 * already replaced it with the X-Forwarded-For value, but only for requests from a trusted proxy.
 */
public final class ClientIp {

    private ClientIp() {
    }

    public static String resolve(HttpServletRequest request) {
        return request.getRemoteAddr();
    }
}
