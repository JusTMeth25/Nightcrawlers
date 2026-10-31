package com.nightcrawlers.common.audit;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "audit_log")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class AuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Plain column (not a relation): the row survives account deletion with {@code user_id} set to null. */
    @Column(name = "user_id")
    private UUID userId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private AuditEvent event;

    @Column(name = "ip_hash", length = 64)
    private String ipHash;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    public AuditLog(UUID userId, AuditEvent event, String ipHash, Instant createdAt) {
        this.userId = userId;
        this.event = event;
        this.ipHash = ipHash;
        this.createdAt = createdAt;
    }
}
