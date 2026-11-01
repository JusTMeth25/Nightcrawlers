package com.nightcrawlers.user;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import jakarta.persistence.LockModeType;

public interface UserRepository extends JpaRepository<User, UUID> {

    /** Row-locked read: serializes per-user operations such as starting a run. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select u from User u where u.id = :id")
    Optional<User> findByIdForUpdate(@Param("id") UUID id);

    /** Email is stored normalized: pass a normalized value. */
    Optional<User> findByEmail(String email);

    @Query("select u from User u where lower(u.username) = lower(:username)")
    Optional<User> findByUsernameIgnoreCase(@Param("username") String username);

    @Query("select count(u) > 0 from User u where lower(u.username) = lower(:username)")
    boolean existsByUsernameIgnoreCase(@Param("username") String username);

    /** Atomic increment, safe under parallel attempts; returns the new count. */
    @Transactional
    @Query(value = "UPDATE users SET failed_logins = failed_logins + 1 WHERE id = :id RETURNING failed_logins",
            nativeQuery = true)
    int incrementFailedLogins(@Param("id") UUID id);

    @Transactional
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("update User u set u.lockedUntil = :until where u.id = :id")
    void lockUntil(@Param("id") UUID id, @Param("until") Instant until);

    @Transactional
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("update User u set u.failedLogins = 0, u.lockedUntil = null where u.id = :id")
    void resetFailedLogins(@Param("id") UUID id);
}
