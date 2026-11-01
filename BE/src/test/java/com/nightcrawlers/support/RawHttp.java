package com.nightcrawlers.support;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

/**
 * Real HTTP against the embedded Tomcat (RANDOM_PORT). Unlike MockMvc it exercises Tomcat's
 * URI decoding and valves; the path is sent exactly as given (no client normalization).
 */
public final class RawHttp {

    private static final HttpClient CLIENT = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();

    private final int port;

    public RawHttp(int port) {
        this.port = port;
    }

    public HttpResponse<String> post(String rawPath, String jsonBody, String... headers) {
        HttpRequest.Builder builder = HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + rawPath))
                .timeout(Duration.ofSeconds(10))
                .header("Content-Type", "application/json")
                .POST(jsonBody == null ? HttpRequest.BodyPublishers.noBody()
                        : HttpRequest.BodyPublishers.ofString(jsonBody));
        for (int i = 0; i < headers.length; i += 2) {
            builder.header(headers[i], headers[i + 1]);
        }
        try {
            return CLIENT.send(builder.build(), HttpResponse.BodyHandlers.ofString());
        } catch (IOException e) {
            throw new IllegalStateException(e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException(e);
        }
    }

    public static String loginBody(String login, String password) {
        return "{\"login\":\"%s\",\"password\":\"%s\"}".formatted(login, password);
    }
}
