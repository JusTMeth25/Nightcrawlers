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
@Table(name = "enemy_kill_stats")
@IdClass(EnemyKillStat.Key.class)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class EnemyKillStat {

    @Id
    @Column(name = "user_id")
    private UUID userId;

    @Id
    @Column(name = "enemy_id", length = 32)
    private String enemyId;

    @Setter
    @Column(nullable = false)
    private long count;

    public EnemyKillStat(UUID userId, String enemyId, long count) {
        this.userId = userId;
        this.enemyId = enemyId;
        this.count = count;
    }

    public record Key(UUID userId, String enemyId) implements Serializable {
    }
}
