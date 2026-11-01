package com.nightcrawlers.run;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import jakarta.persistence.LockModeType;

public interface RunRecordRepository extends JpaRepository<RunRecord, UUID> {

    /** The run of this user, row-locked: checkpoint and end of the same run are serialized. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from RunRecord r where r.id = :id and r.userId = :userId")
    Optional<RunRecord> findOwnedForUpdate(@Param("id") UUID id, @Param("userId") UUID userId);

    List<RunRecord> findByUserId(UUID userId);

    /** Row-locks every run of the user (account deletion), in a stable order. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from RunRecord r where r.userId = :userId order by r.id")
    List<RunRecord> lockAllForUser(@Param("userId") UUID userId);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("""
            update RunRecord r set r.status = com.nightcrawlers.run.RunRecord.Status.ABANDONED, r.endedAt = :now
            where r.userId = :userId and r.status = com.nightcrawlers.run.RunRecord.Status.ACTIVE""")
    int abandonActive(@Param("userId") UUID userId, @Param("now") Instant now);

    @Query("""
            select r from RunRecord r
            where r.userId = :userId and r.status = com.nightcrawlers.run.RunRecord.Status.ENDED
            order by r.durationSec desc, r.endedAt asc""")
    List<RunRecord> findBest(@Param("userId") UUID userId, Pageable page);
}
