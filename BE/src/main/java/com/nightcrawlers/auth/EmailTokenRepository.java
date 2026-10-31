package com.nightcrawlers.auth;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface EmailTokenRepository extends JpaRepository<EmailToken, UUID> {

    Optional<EmailToken> findByTokenHashAndPurpose(String tokenHash, EmailToken.Purpose purpose);

    /** Atomically consumes a token: 1 row updated only if it is unused and not expired. */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("""
            update EmailToken t set t.usedAt = :now
            where t.id = :id and t.usedAt is null and t.expiresAt > :now""")
    int markUsed(@Param("id") UUID id, @Param("now") Instant now);

    /** A new token supersedes the open ones of the same purpose. */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("""
            update EmailToken t set t.usedAt = :now
            where t.userId = :userId and t.purpose = :purpose and t.usedAt is null""")
    int invalidateOpen(@Param("userId") UUID userId, @Param("purpose") EmailToken.Purpose purpose,
            @Param("now") Instant now);
}
