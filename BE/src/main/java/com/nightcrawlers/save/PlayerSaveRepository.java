package com.nightcrawlers.save;

import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface PlayerSaveRepository extends JpaRepository<PlayerSave, UUID> {
}
