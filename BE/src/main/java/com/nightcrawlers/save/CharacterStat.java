package com.nightcrawlers.save;

import java.io.Serializable;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "character_stats")
@IdClass(CharacterStat.Key.class)
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class CharacterStat {

    @Id
    @Column(name = "user_id")
    private UUID userId;

    @Id
    @Column(name = "character_id", length = 32)
    private String characterId;

    @Column(name = "best_time_sec", nullable = false)
    private int bestTimeSec;

    @Column(nullable = false)
    private long runs;

    public CharacterStat(UUID userId, String characterId, int bestTimeSec, long runs) {
        this.userId = userId;
        this.characterId = characterId;
        this.bestTimeSec = bestTimeSec;
        this.runs = runs;
    }

    public record Key(UUID userId, String characterId) implements Serializable {
    }
}
