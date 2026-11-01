package com.nightcrawlers.save;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface EnemyKillStatRepository extends JpaRepository<EnemyKillStat, EnemyKillStat.Key> {

    List<EnemyKillStat> findByUserId(UUID userId);
}
