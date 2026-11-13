package com.nightcrawlers.common;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import tools.jackson.databind.json.JsonMapper;

/** Writes {@code application/problem+json} from servlet filters, outside Spring MVC. */
@Component
public class ProblemResponses {

    private final JsonMapper jsonMapper;
    private final Messages messages;

    public ProblemResponses(JsonMapper jsonMapper, Messages messages) {
        this.jsonMapper = jsonMapper;
        this.messages = messages;
    }

    /**
     * Writes the problem {@code <code>.title} / {@code <code>.detail} in the language of the
     * request's {@code Accept-Language} (filters run before Spring MVC resolves it).
     */
    public void write(HttpServletRequest request, HttpServletResponse response, HttpStatus status, String code,
            Object... detailArgs) throws IOException {
        Locale locale = SupportedLocales.fromAcceptLanguage(request.getHeader(HttpHeaders.ACCEPT_LANGUAGE));
        String title = messages.get(code + ".title", locale);
        String detail = messages.optional(code + ".detail", locale, detailArgs);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("type", "about:blank");
        body.put("title", title);
        body.put("status", status.value());
        if (detail != null) {
            body.put("detail", detail);
        }
        body.put("instance", request.getRequestURI());
        response.setStatus(status.value());
        response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        response.getWriter().write(jsonMapper.writeValueAsString(body));
    }
}
