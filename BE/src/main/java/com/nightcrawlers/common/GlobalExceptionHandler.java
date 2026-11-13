package com.nightcrawlers.common;

import java.net.URI;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

import org.hibernate.exception.ConstraintViolationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.i18n.LocaleContextHolder;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.dao.PessimisticLockingFailureException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

/** Every error leaves the API as RFC 9457 {@code application/problem+json}, never with a stack trace. */
@RestControllerAdvice
public class GlobalExceptionHandler extends ResponseEntityExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);
    private static final URI BLANK_TYPE = URI.create("about:blank");

    private final Messages messages;

    public GlobalExceptionHandler(Messages messages) {
        this.messages = messages;
    }

    /** The contract requires {@code type}; Spring 7 leaves it unset unless given. */
    @Override
    protected ResponseEntity<Object> createResponseEntity(Object body, HttpHeaders headers, HttpStatusCode statusCode,
            WebRequest request) {
        if (body instanceof ProblemDetail problem) {
            withType(problem);
            localize(problem, statusCode);
        }
        return super.createResponseEntity(body, headers, statusCode, request);
    }

    /**
     * Spring's built-in errors carry English reason phrases; they are replaced by
     * {@code error.http<status>.title/detail} in the language of the request.
     */
    private void localize(ProblemDetail problem, HttpStatusCode statusCode) {
        HttpStatus status = HttpStatus.resolve(statusCode.value());
        if (status == null || !status.getReasonPhrase().equals(problem.getTitle())) {
            return;
        }
        Locale locale = LocaleContextHolder.getLocale();
        String title = messages.optional("error.http" + status.value() + ".title", locale);
        if (title != null) {
            problem.setTitle(title);
            problem.setDetail(messages.optional("error.http" + status.value() + ".detail", locale));
        }
    }

    private ProblemDetail problem(HttpStatus status, String code, Object... args) {
        Locale locale = LocaleContextHolder.getLocale();
        ProblemDetail problem = ProblemDetail.forStatus(status);
        problem.setTitle(messages.get(code + ".title", locale));
        String detail = messages.optional(code + ".detail", locale, args);
        if (detail != null) {
            problem.setDetail(detail);
        }
        return withType(problem);
    }

    private static ProblemDetail withType(ProblemDetail problem) {
        if (problem.getType() == null) {
            problem.setType(BLANK_TYPE);
        }
        return problem;
    }

    @Override
    protected ResponseEntity<Object> handleMethodArgumentNotValid(MethodArgumentNotValidException ex,
            HttpHeaders headers, HttpStatusCode status, WebRequest request) {
        Map<String, String> errors = new LinkedHashMap<>();
        for (FieldError error : ex.getBindingResult().getFieldErrors()) {
            errors.putIfAbsent(error.getField(), error.getDefaultMessage());
        }
        ProblemDetail problem = problem(HttpStatus.BAD_REQUEST, "error.invalidData");
        problem.setProperty("errors", errors);
        return ResponseEntity.badRequest().headers(headers).body(problem);
    }

    @ExceptionHandler(ApiException.class)
    ResponseEntity<ProblemDetail> handleApi(ApiException ex) {
        Locale locale = LocaleContextHolder.getLocale();
        ProblemDetail problem = problem(ex.getStatus(), ex.getCode(), ex.getDetailArgs());
        if (!ex.getErrors().isEmpty()) {
            Map<String, String> errors = new LinkedHashMap<>();
            ex.getErrors().forEach((field, list) -> errors.put(field, list.stream()
                    .map(m -> messages.get(m.key(), locale, m.args()))
                    .collect(Collectors.joining(" "))));
            problem.setProperty("errors", errors);
        }
        ResponseEntity.BodyBuilder builder = ResponseEntity.status(ex.getStatus());
        ex.getHeaders().forEach(builder::header);
        return builder.body(problem);
    }

    /** Unique-constraint race between the existence check and the insert. */
    @ExceptionHandler(DataIntegrityViolationException.class)
    ResponseEntity<ProblemDetail> handleConflict(DataIntegrityViolationException ex) {
        // Only the constraint name: the database message can contain personal data (emails).
        log.info("Data integrity violation on constraint {}", constraintName(ex));
        return ResponseEntity.status(HttpStatus.CONFLICT).body(problem(HttpStatus.CONFLICT, "error.conflict"));
    }

    static String constraintName(Throwable ex) {
        for (Throwable t = ex; t != null; t = t.getCause()) {
            if (t instanceof ConstraintViolationException cve && cve.getConstraintName() != null) {
                return cve.getConstraintName();
            }
        }
        return "unknown";
    }

    /**
     * Concurrent change of the same row: optimistic lock on {@code @Version}, lock timeout or
     * deadlock victim. The client can simply retry.
     */
    @ExceptionHandler({ OptimisticLockingFailureException.class, PessimisticLockingFailureException.class })
    ResponseEntity<ProblemDetail> handleStale(Exception ex) {
        log.info("Lock conflict: {}", ex.getClass().getSimpleName());
        return ResponseEntity.status(HttpStatus.CONFLICT).body(problem(HttpStatus.CONFLICT, "error.staleData"));
    }

    /**
     * Exception messages can carry personal data (emails, usernames, SQL parameters), so only
     * the exception classes and the code location are logged, under an {@code errorId} that is
     * also returned to the client for support requests.
     */
    @ExceptionHandler(Exception.class)
    ResponseEntity<ProblemDetail> handleUnexpected(Exception ex) {
        String errorId = UUID.randomUUID().toString();
        log.error("Unhandled exception [errorId={}]: {} at {}", errorId, classChain(ex), location(ex));
        ProblemDetail problem = problem(HttpStatus.INTERNAL_SERVER_ERROR, "error.internal");
        problem.setProperty("errorId", errorId);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(problem);
    }

    /** {@code Outer <- Cause <- RootCause}, class names only. */
    static String classChain(Throwable ex) {
        StringBuilder chain = new StringBuilder();
        int depth = 0;
        for (Throwable t = ex; t != null && depth < 10; t = t.getCause() == t ? null : t.getCause(), depth++) {
            if (!chain.isEmpty()) {
                chain.append(" <- ");
            }
            chain.append(t.getClass().getName());
        }
        return chain.toString();
    }

    /** The innermost application frame of the chain, or the top frame when there is none. */
    static String location(Throwable ex) {
        String found = null;
        int depth = 0;
        for (Throwable t = ex; t != null && depth < 10; t = t.getCause() == t ? null : t.getCause(), depth++) {
            for (StackTraceElement frame : t.getStackTrace()) {
                if (frame.getClassName().startsWith("com.nightcrawlers.")) {
                    found = frame.toString();
                    break;
                }
            }
        }
        if (found != null) {
            return found;
        }
        StackTraceElement[] top = ex.getStackTrace();
        return top.length > 0 ? top[0].toString() : "unknown";
    }
}
