package com.nightcrawlers.run;

import java.time.Clock;
import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.nightcrawlers.auth.CurrentUser;
import com.nightcrawlers.run.dto.BestRunDto;
import com.nightcrawlers.run.dto.CheckpointRequest;
import com.nightcrawlers.run.dto.EndRunRequest;
import com.nightcrawlers.run.dto.EndRunResponse;
import com.nightcrawlers.run.dto.StartRunRequest;
import com.nightcrawlers.run.dto.StartRunResponse;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/runs")
public class RunController {

    private final RunService runs;
    private final Clock clock;

    public RunController(RunService runs, Clock clock) {
        this.runs = runs;
        this.clock = clock;
    }

    @PostMapping("/start")
    public ResponseEntity<StartRunResponse> start(@Valid @RequestBody StartRunRequest request,
            Authentication authentication) {
        StartRunResponse started = runs.start(CurrentUser.id(authentication), request.characterId(), clock.instant());
        return ResponseEntity.status(HttpStatus.CREATED).body(started);
    }

    @PostMapping("/{id}/checkpoint")
    public ResponseEntity<Void> checkpoint(@PathVariable String id, @Valid @RequestBody CheckpointRequest request,
            Authentication authentication) {
        runs.checkpoint(CurrentUser.id(authentication), runId(id), request, clock.instant());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/end")
    public EndRunResponse end(@PathVariable String id, @Valid @RequestBody EndRunRequest request,
            Authentication authentication, HttpServletRequest http) {
        return runs.end(CurrentUser.id(authentication), runId(id), request, clock.instant(), http);
    }

    @GetMapping("/best")
    public List<BestRunDto> best(Authentication authentication) {
        return runs.best(CurrentUser.id(authentication));
    }

    /** A malformed id names no run: 404 like any unknown run. */
    private static UUID runId(String id) {
        try {
            return UUID.fromString(id);
        } catch (IllegalArgumentException e) {
            throw RunService.notFound();
        }
    }
}
