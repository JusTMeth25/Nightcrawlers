package com.nightcrawlers.save;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface UnlockedCharacterRepository extends JpaRepository<UnlockedCharacter, UnlockedCharacter.Key> {

    List<UnlockedCharacter> findByUserId(UUID userId);
}
