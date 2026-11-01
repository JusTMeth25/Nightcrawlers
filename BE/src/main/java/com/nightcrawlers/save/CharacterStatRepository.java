package com.nightcrawlers.save;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface CharacterStatRepository extends JpaRepository<CharacterStat, CharacterStat.Key> {

    List<CharacterStat> findByUserId(UUID userId);
}
