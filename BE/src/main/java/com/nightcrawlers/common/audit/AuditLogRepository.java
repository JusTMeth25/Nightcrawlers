package com.nightcrawlers.common.audit;

import java.util.List;
import java.util.UUID;

import java.time.Instant;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {

    List<AuditLog> findByUserId(UUID userId);

    long countByEvent(AuditEvent event);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("update AuditLog a set a.ipHash = null where a.ipHash is not null and a.createdAt < :cutoff")
    int clearIpHashesBefore(@Param("cutoff") Instant cutoff);

    /** Rows of deleted accounts (user_id null) older than the cutoff. */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("delete from AuditLog a where a.userId is null and a.createdAt < :cutoff")
    int deleteDetachedBefore(@Param("cutoff") Instant cutoff);
}
