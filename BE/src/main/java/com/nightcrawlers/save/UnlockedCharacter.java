package com.nightcrawlers.save;

import java.io.Serializable;
import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "unlocked_characters")
@IdClass(UnlockedCharacter.Key.class)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class UnlockedCharacter {

    @Id
    @Column(name = "user_id")
    private UUID userId;

    @Id
    @Column(name = "character_id", length = 32)
    private String characterId;

    @Column(name = "unlocked_at", nullable = false)
    private Instant unlockedAt;

    public UnlockedCharacter(UUID userId, String characterId, Instant unlockedAt) {
        this.userId = userId;
        this.characterId = characterId;
        this.unlockedAt = unlockedAt;
    }

    public record Key(UUID userId, String characterId) implements Serializable {
    }
}
