package com.nightcrawlers.save;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface RipperdocUpgradeRepository extends JpaRepository<RipperdocUpgrade, RipperdocUpgrade.Key> {

    List<RipperdocUpgrade> findByUserId(UUID userId);
}
