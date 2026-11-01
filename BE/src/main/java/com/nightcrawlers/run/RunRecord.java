package com.nightcrawlers.run;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** One run of a registered player (table {@code runs}). */
@Entity
@Table(name = "runs")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class RunRecord {

    public enum Status {
        ACTIVE, ENDED, FLAGGED, ABANDONED
    }

    @Id
    private UUID id;

    @Column(name = "user_id", nullable = false, updatable = false)
    private UUID userId;

    @Column(name = "character_id", nullable = false, length = 32, updatable = false)
    private String characterId;

    @Column(nullable = false, updatable = false)
    private int seed;

    @Column(name = "started_at", nullable = false, updatable = false)
    private Instant startedAt;

    @Column(name = "ended_at")
    private Instant endedAt;

    @Column(name = "last_checkpoint_at")
    private Instant lastCheckpointAt;

    @Column(name = "duration_sec")
    private Integer durationSec;

    private Long kills;

    private Integer level;

    @Column(name = "eurodollars_awarded", nullable = false)
    private long eurodollarsAwarded;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private Status status;

    /** Set by an implausible checkpoint; the run is then flagged when it ends. */
    @Column(name = "flag_reason", length = 64)
    private String flagReason;

    public RunRecord(UUID userId, String characterId, int seed, Instant startedAt) {
        this.id = UUID.randomUUID();
        this.userId = userId;
        this.characterId = characterId;
        this.seed = seed;
        this.startedAt = startedAt;
        this.status = Status.ACTIVE;
    }
}
