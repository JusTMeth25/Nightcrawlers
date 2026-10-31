package com.nightcrawlers.save;

import java.io.Serializable;
import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "codex_entries")
@IdClass(CodexEntry.Key.class)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class CodexEntry {

    public enum Type {
        ENEMY, WEAPON
    }

    @Id
    @Column(name = "user_id")
    private UUID userId;

    @Id
    @Enumerated(EnumType.STRING)
    @Column(name = "entry_type", length = 8)
    private Type entryType;

    @Id
    @Column(name = "entry_id", length = 32)
    private String entryId;

    @Column(name = "discovered_at", nullable = false)
    private Instant discoveredAt;

    public CodexEntry(UUID userId, Type entryType, String entryId, Instant discoveredAt) {
        this.userId = userId;
        this.entryType = entryType;
        this.entryId = entryId;
        this.discoveredAt = discoveredAt;
    }

    public record Key(UUID userId, Type entryType, String entryId) implements Serializable {
    }
}
