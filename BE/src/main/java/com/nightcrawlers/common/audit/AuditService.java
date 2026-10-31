package com.nightcrawlers.common.audit;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.util.HexFormat;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.nightcrawlers.common.ClientIp;

import jakarta.servlet.http.HttpServletRequest;

/** Security audit trail. The client IP is stored only as {@code sha256(salt + ip)}. */
@Service
public class AuditService {

    private final AuditLogRepository repository;
    private final Clock clock;
    private final String salt;

    public AuditService(AuditLogRepository repository, Clock clock, @Value("${app.ip-hash-salt}") String salt) {
        this.repository = repository;
        this.clock = clock;
        this.salt = salt;
    }

    /**
     * Joins the caller's transaction (the user row may not be committed yet). Callers that
     * record a failure must do so outside a transaction that is about to roll back.
     */
    @Transactional
    public void record(AuditEvent event, UUID userIdOrNull, HttpServletRequest request) {
        String ipHash = request == null ? null : hashIp(ClientIp.resolve(request));
        repository.save(new AuditLog(userIdOrNull, event, ipHash, clock.instant()));
    }

    String hashIp(String ip) {
        if (ip == null) {
            return null;
        }
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest((salt + ip).getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 not available", e);
        }
    }
}
