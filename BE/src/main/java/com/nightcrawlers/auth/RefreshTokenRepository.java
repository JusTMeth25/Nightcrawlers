package com.nightcrawlers.auth;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import jakarta.persistence.LockModeType;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, UUID> {

    Optional<RefreshToken> findByTokenHash(String tokenHash);

    /** Row-locked read: concurrent retries with the same old token are handled one at a time. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select t from RefreshToken t where t.tokenHash = :hash")
    Optional<RefreshToken> findByTokenHashForUpdate(@Param("hash") String tokenHash);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("update RefreshToken t set t.replacedBy = :successor where t.id = :id")
    int setReplacedBy(@Param("id") UUID id, @Param("successor") UUID successor);

    /** Revokes a successor that was never used; 0 if it was used (or revoked) meanwhile. */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("""
            update RefreshToken t set t.revokedAt = :now
            where t.id = :id and t.usedAt is null and t.revokedAt is null""")
    int supersedeUnused(@Param("id") UUID id, @Param("now") Instant now);

    List<RefreshToken> findByUserId(UUID userId);

    /** Creation time of the first token of the family, i.e. of the login. */
    @Query("select min(t.createdAt) from RefreshToken t where t.familyId = :familyId")
    Instant familyStart(@Param("familyId") UUID familyId);

    /**
     * Atomic single use: exactly one of several concurrent callers gets 1; the others wait for
     * the row lock, re-check the condition and get 0.
     */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("""
            update RefreshToken t set t.usedAt = :now
            where t.tokenHash = :hash and t.usedAt is null and t.revokedAt is null and t.expiresAt > :now""")
    int markUsed(@Param("hash") String tokenHash, @Param("now") Instant now);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("update RefreshToken t set t.revokedAt = :now where t.familyId = :familyId and t.revokedAt is null")
    int revokeFamily(@Param("familyId") UUID familyId, @Param("now") Instant now);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("update RefreshToken t set t.revokedAt = :now where t.userId = :userId and t.revokedAt is null")
    int revokeAllForUser(@Param("userId") UUID userId, @Param("now") Instant now);

    /**
     * Deletes whole families that can no longer be used (every token expired or revoked). A
     * used token of a live family is kept: presenting it again must still revoke the family.
     */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query(value = """
            DELETE FROM refresh_tokens t
            WHERE NOT EXISTS (SELECT 1 FROM refresh_tokens x
                              WHERE x.family_id = t.family_id AND x.revoked_at IS NULL AND x.expires_at > :now)""",
            nativeQuery = true)
    int deleteDeadFamilies(@Param("now") Instant now);
}
