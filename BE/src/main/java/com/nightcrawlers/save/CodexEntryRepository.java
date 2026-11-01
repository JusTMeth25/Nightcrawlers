package com.nightcrawlers.save;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface CodexEntryRepository extends JpaRepository<CodexEntry, CodexEntry.Key> {

    List<CodexEntry> findByUserId(UUID userId);
}
