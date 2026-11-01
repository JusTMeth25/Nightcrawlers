package com.nightcrawlers.run;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** Accepted intermediate progress of a run (table {@code run_checkpoints}). */
@Entity
@Table(name = "run_checkpoints")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class RunCheckpoint {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "run_id", nullable = false)
    private UUID runId;

    @Column(nullable = false)
    private Instant at;

    @Column(name = "elapsed_sec", nullable = false)
    private double elapsedSec;

    @Column(nullable = false)
    private long kills;

    @Column(nullable = false)
    private int level;

    @Column(nullable = false)
    private long eurodollars;

    public RunCheckpoint(UUID runId, Instant at, double elapsedSec, long kills, int level, long eurodollars) {
        this.runId = runId;
        this.at = at;
        this.elapsedSec = elapsedSec;
        this.kills = kills;
        this.level = level;
        this.eurodollars = eurodollars;
    }
}
