package com.nightcrawlers.common;

import java.net.URI;
import java.util.LinkedHashMap;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
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
        }
        return super.createResponseEntity(body, headers, statusCode, request);
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
        log.info("Data integrity violation: {}", ex.getMostSpecificCause().getMessage());
        ProblemDetail problem = ProblemDetail.forStatus(HttpStatus.CONFLICT);
        problem.setTitle("Conflitto");
        problem.setDetail("La richiesta è in conflitto con dati esistenti.");
        return ResponseEntity.status(HttpStatus.CONFLICT).body(withType(problem));
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<ProblemDetail> handleUnexpected(Exception ex) {
        log.error("Unhandled exception", ex);
        ProblemDetail problem = ProblemDetail.forStatus(HttpStatus.INTERNAL_SERVER_ERROR);
        problem.setTitle("Errore interno");
        problem.setDetail("Si è verificato un errore imprevisto.");
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(withType(problem));
    }
}
