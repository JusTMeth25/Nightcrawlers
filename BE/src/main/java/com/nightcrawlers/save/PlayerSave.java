package com.nightcrawlers.save;

import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "player_saves")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class PlayerSave {

    @Id
    @Column(name = "user_id")
    private UUID userId;

    @Column(nullable = false)
    private long eurodollars;

    @Column(name = "total_eurodollars_earned", nullable = false)
    private long totalEurodollarsEarned;

    @Column(name = "total_kills", nullable = false)
    private long totalKills;

    @Column(name = "best_time_sec", nullable = false)
    private int bestTimeSec;

    /** Optimistic lock for concurrent purchases and run rewards. */
    @Version
    @Column(nullable = false)
    private long version;

    public PlayerSave(UUID userId) {
        this.userId = userId;
    }
}
