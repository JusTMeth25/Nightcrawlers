package com.nightcrawlers.run;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface RunCheckpointRepository extends JpaRepository<RunCheckpoint, Long> {

    /** The last accepted checkpoint (ids grow with insertion). */
    Optional<RunCheckpoint> findFirstByRunIdOrderByIdDesc(UUID runId);

    List<RunCheckpoint> findByRunIdInOrderByIdAsc(Collection<UUID> runIds);
}
