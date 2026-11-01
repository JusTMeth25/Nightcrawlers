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
@Table(name = "ripperdoc_upgrades")
@IdClass(RipperdocUpgrade.Key.class)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class RipperdocUpgrade {

    @Id
    @Column(name = "user_id")
    private UUID userId;

    @Id
    @Column(name = "upgrade_id", length = 32)
    private String upgradeId;

    @Setter
    @Column(nullable = false)
    private int rank;

    public RipperdocUpgrade(UUID userId, String upgradeId, int rank) {
        this.userId = userId;
        this.upgradeId = upgradeId;
        this.rank = rank;
    }

    public record Key(UUID userId, String upgradeId) implements Serializable {
    }
}
