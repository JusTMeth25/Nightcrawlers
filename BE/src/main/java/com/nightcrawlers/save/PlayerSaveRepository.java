package com.nightcrawlers.save;

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import jakarta.persistence.LockModeType;

public interface PlayerSaveRepository extends JpaRepository<PlayerSave, UUID> {

    /**
     * Row-locked read for the end of a run. The {@code @Version} still increments on update, so
     * a concurrent optimistic writer (a Ripperdoc purchase) detects the change and retries.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from PlayerSave s where s.userId = :userId")
    Optional<PlayerSave> findForUpdate(@Param("userId") UUID userId);
}
