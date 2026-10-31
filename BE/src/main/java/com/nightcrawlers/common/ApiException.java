package com.nightcrawlers.common;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.http.HttpStatus;

/** Business error rendered by {@link GlobalExceptionHandler} as {@code application/problem+json}. */
public class ApiException extends RuntimeException {

    private final HttpStatus status;
    private final String title;
    private final String detail;
    private final Map<String, String> headers = new LinkedHashMap<>();

    public ApiException(HttpStatus status, String title, String detail) {
        super(title);
        this.status = status;
        this.title = title;
        this.detail = detail;
    }

    public ApiException(HttpStatus status, String title) {
        this(status, title, null);
    }

    /** Adds a response header, for example {@code Retry-After}. */
    public ApiException withHeader(String name, String value) {
        headers.put(name, value);
        return this;
    }

    public HttpStatus getStatus() {
        return status;
    }

    public String getTitle() {
        return title;
    }

    public String getDetail() {
        return detail;
    }

    public Map<String, String> getHeaders() {
        return Collections.unmodifiableMap(headers);
    }
}
