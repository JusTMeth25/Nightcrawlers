package com.nightcrawlers.common;

import java.net.URI;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

import org.hibernate.exception.ConstraintViolationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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

    /** The contract requires {@code type}; Spring 7 leaves it unset unless given. */
    @Override
    protected ResponseEntity<Object> createResponseEntity(Object body, HttpHeaders headers, HttpStatusCode statusCode,
            WebRequest request) {
        if (body instanceof ProblemDetail problem) {
            withType(problem);
            italianize(problem, statusCode);
        }
        return super.createResponseEntity(body, headers, statusCode, request);
    }

    /** Spring's built-in errors carry English reason phrases; the UI shows titles to Italian users. */
    private static final Map<Integer, String[]> ITALIAN = Map.of(
            400, new String[] { "Richiesta non valida", "La richiesta non è leggibile o non è valida." },
            404, new String[] { "Risorsa non trovata", "La risorsa richiesta non esiste." },
            405, new String[] { "Metodo non consentito", "Metodo HTTP non supportato per questa risorsa." },
            406, new String[] { "Formato non accettabile", "Formato di risposta non disponibile." },
            413, new String[] { "Richiesta troppo grande", "Il corpo della richiesta è troppo grande." },
            415, new String[] { "Formato non supportato", "Tipo di contenuto non supportato." });

    private static void italianize(ProblemDetail problem, HttpStatusCode statusCode) {
        String[] text = ITALIAN.get(statusCode.value());
        HttpStatus status = HttpStatus.resolve(statusCode.value());
        if (text != null && status != null && status.getReasonPhrase().equals(problem.getTitle())) {
            problem.setTitle(text[0]);
            problem.setDetail(text[1]);
        }
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
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST,
                "Uno o più campi non sono validi.");
        problem.setTitle("Dati non validi");
        problem.setProperty("errors", errors);
        return ResponseEntity.badRequest().headers(headers).body(withType(problem));
    }

    @ExceptionHandler(ApiException.class)
    ResponseEntity<ProblemDetail> handleApi(ApiException ex) {
        ProblemDetail problem = ProblemDetail.forStatus(ex.getStatus());
        problem.setTitle(ex.getTitle());
        if (ex.getDetail() != null) {
            problem.setDetail(ex.getDetail());
        }
        if (!ex.getErrors().isEmpty()) {
            problem.setProperty("errors", ex.getErrors());
        }
        ResponseEntity.BodyBuilder builder = ResponseEntity.status(ex.getStatus());
        ex.getHeaders().forEach(builder::header);
        return builder.body(withType(problem));
    }

    /** Unique-constraint race between the existence check and the insert. */
    @ExceptionHandler(DataIntegrityViolationException.class)
    ResponseEntity<ProblemDetail> handleConflict(DataIntegrityViolationException ex) {
        // Only the constraint name: the database message can contain personal data (emails).
        log.info("Data integrity violation on constraint {}", constraintName(ex));
        ProblemDetail problem = ProblemDetail.forStatus(HttpStatus.CONFLICT);
        problem.setTitle("Conflitto");
        problem.setDetail("La richiesta è in conflitto con dati esistenti.");
        return ResponseEntity.status(HttpStatus.CONFLICT).body(withType(problem));
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
        ProblemDetail problem = ProblemDetail.forStatus(HttpStatus.CONFLICT);
        problem.setTitle("Conflitto");
        problem.setDetail("I dati sono stati modificati da un'altra richiesta. Riprova.");
        return ResponseEntity.status(HttpStatus.CONFLICT).body(withType(problem));
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
        ProblemDetail problem = ProblemDetail.forStatus(HttpStatus.INTERNAL_SERVER_ERROR);
        problem.setTitle("Errore interno");
        problem.setDetail("Si è verificato un errore imprevisto.");
        problem.setProperty("errorId", errorId);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(withType(problem));
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
