package com.nightcrawlers.common;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;

/**
 * Business error rendered by {@link GlobalExceptionHandler} as {@code application/problem+json}.
 * It carries message keys, not text: the handler resolves {@code <code>.title} and the optional
 * {@code <code>.detail} (with {@link #getDetailArgs()}) in the language of the request
 * ({@code i18n/messages_*.properties}).
 */
public class ApiException extends RuntimeException {

    /** A message key with its arguments. */
    public record Message(String key, Object... args) {
    }

    private final HttpStatus status;
    private final String code;
    private final Object[] detailArgs;
    private final Map<String, String> headers = new LinkedHashMap<>();
    private final Map<String, List<Message>> errors = new LinkedHashMap<>();

    /**
     * @param code key prefix such as {@code error.invalidCredentials}
     * @param detailArgs arguments of {@code <code>.detail}
     */
    public ApiException(HttpStatus status, String code, Object... detailArgs) {
        super(code);
        this.status = status;
        this.code = code;
        this.detailArgs = detailArgs.clone();
    }

    /** Adds a response header, for example {@code Retry-After}. */
    public ApiException withHeader(String name, String value) {
        headers.put(name, value);
        return this;
    }

    /**
     * Adds a field error message key, rendered in the {@code errors} member of the problem. Several
     * messages for the same field are joined with a space.
     */
    public ApiException withError(String field, String key, Object... args) {
        errors.computeIfAbsent(field, f -> new ArrayList<>()).add(new Message(key, args.clone()));
        return this;
    }

    public Map<String, List<Message>> getErrors() {
        return Collections.unmodifiableMap(errors);
    }

    public HttpStatus getStatus() {
        return status;
    }

    public String getCode() {
        return code;
    }

    public String getTitleKey() {
        return code + ".title";
    }

    public String getDetailKey() {
        return code + ".detail";
    }

    public Object[] getDetailArgs() {
        return detailArgs.clone();
    }

    public Map<String, String> getHeaders() {
        return Collections.unmodifiableMap(headers);
    }
}
