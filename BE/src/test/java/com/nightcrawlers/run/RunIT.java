package com.nightcrawlers.run;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;

import com.jayway.jsonpath.JsonPath;
import com.nightcrawlers.common.audit.AuditEvent;
import com.nightcrawlers.common.audit.AuditLog;
import com.nightcrawlers.common.audit.AuditLogRepository;
import com.nightcrawlers.save.RipperdocUpgrade;
import com.nightcrawlers.save.RipperdocUpgradeRepository;
import com.nightcrawlers.support.CapturingMailService;
import com.nightcrawlers.support.IntegrationTest;
import com.nightcrawlers.support.MutableClock;
import com.nightcrawlers.support.TestApi;
import com.nightcrawlers.support.TestApi.Account;
import com.nightcrawlers.support.TestApi.Session;
import com.nightcrawlers.user.UserRepository;

@IntegrationTest
class RunIT {

    /** 605 s, 300 kills (250 Maelstrom + 50 Arasaka), level 20, 800 €$ collected. */
    static final String VALID_END = """
            {"characterId":"david","durationSec":605.4,"kills":300,
             "killsByEnemy":{"maelstrom":250,"arasaka":50},"level":20,"eurodollarsCollected":800,
             "weaponsSeen":["pistol","shotgun"],"enemiesSeen":["maelstrom","arasaka"]}""";
    static final String FIRST_CHECKPOINT = """
            {"elapsedSec":60,"kills":100,"level":3,"eurodollars":50}""";

    @Autowired
    MockMvc mvc;
    @Autowired
    CapturingMailService mail;
    @Autowired
    MutableClock clock;
    @Autowired
    UserRepository users;
    @Autowired
    RunRecordRepository runs;
    @Autowired
    RipperdocUpgradeRepository upgrades;
    @Autowired
    AuditLogRepository auditLog;
    @Autowired
    RewardCalculator rewards;

    TestApi api;

    @BeforeEach
    void setUp() {
        clock.reset();
        api = new TestApi(mvc, mail);
    }

    private Session verifiedSession() throws Exception {
        return api.loginSession(api.registerVerified());
    }

    private UUID userId(Account account) {
        return users.findByEmail(account.email()).orElseThrow().getId();
    }

    private ResultActions start(Session session, String characterId) throws Exception {
        return mvc.perform(post("/api/runs/start").header("Authorization", session.bearer())
                .contentType(MediaType.APPLICATION_JSON).content("{\"characterId\":\"" + characterId + "\"}"));
    }

    private String startRun(Session session) throws Exception {
        MvcResult result = start(session, "david").andExpect(status().isCreated()).andReturn();
        return JsonPath.read(result.getResponse().getContentAsString(), "$.runId");
    }

    private ResultActions checkpoint(Session session, String runId, String body) throws Exception {
        return mvc.perform(post("/api/runs/" + runId + "/checkpoint").header("Authorization", session.bearer())
                .contentType(MediaType.APPLICATION_JSON).content(body));
    }

    private ResultActions end(Session session, String runId, String body) throws Exception {
        return mvc.perform(post("/api/runs/" + runId + "/end").header("Authorization", session.bearer())
                .contentType(MediaType.APPLICATION_JSON).content(body));
    }

    private RunRecord run(String runId) {
        return runs.findById(UUID.fromString(runId)).orElseThrow();
    }

    @Test
    void startRequiresAVerifiedEmail() throws Exception {
        Session session = api.loginSession(api.register());

        start(session, "david")
                .andExpect(status().isForbidden())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.title").value("Email non verificata"));
    }

    @Test
    void startWithALockedCharacterIsForbidden() throws Exception {
        start(verifiedSession(), "maine")
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.title").value("Personaggio non sbloccato"));
    }

    @Test
    void startWithAnUnknownCharacterIsInvalid() throws Exception {
        start(verifiedSession(), "johnny")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.characterId").isString());
    }

    @Test
    void startRequiresAuthentication() throws Exception {
        mvc.perform(post("/api/runs/start").contentType(MediaType.APPLICATION_JSON)
                .content("{\"characterId\":\"david\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void startReturnsAServerSeedAndStartTime() throws Exception {
        Instant before = clock.instant().truncatedTo(ChronoUnit.SECONDS);
        MvcResult result = start(verifiedSession(), "lucy")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.runId").isString())
                .andReturn();
        String body = result.getResponse().getContentAsString();
        int seed = JsonPath.read(body, "$.seed");
        assertThat(seed).isBetween(0, Integer.MAX_VALUE - 1);
        Instant startedAt = Instant.parse(JsonPath.read(body, "$.startedAt"));
        assertThat(startedAt).isAfterOrEqualTo(before);
        RunRecord stored = run(JsonPath.read(body, "$.runId"));
        assertThat(stored.getStatus()).isEqualTo(RunRecord.Status.ACTIVE);
        assertThat(stored.getCharacterId()).isEqualTo("lucy");
        assertThat(stored.getSeed()).isEqualTo(seed);
    }

    @Test
    void validRunIsRewardedAndUnlocksMaine() throws Exception {
        Session session = verifiedSession();
        String runId = startRun(session);
        clock.advance(Duration.ofSeconds(61));
        checkpoint(session, runId, FIRST_CHECKPOINT).andExpect(status().isNoContent());
        clock.advance(Duration.ofSeconds(549));
        long expected = rewards.compute(605, 300, 0);

        end(session, runId, VALID_END)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.eurodollarsAwarded").value(expected))
                .andExpect(jsonPath("$.flagged").value(false))
                .andExpect(jsonPath("$.newUnlocks", contains("maine")))
                .andExpect(jsonPath("$.save.eurodollars").value(expected))
                .andExpect(jsonPath("$.save.totalEurodollarsEarned").value(expected))
                .andExpect(jsonPath("$.save.totalKills").value(300))
                .andExpect(jsonPath("$.save.bestTimeSec").value(605))
                .andExpect(jsonPath("$.save.unlockedCharacters", contains("david", "lucy", "rebecca", "maine")))
                .andExpect(jsonPath("$.save.killStats.maelstrom").value(250))
                .andExpect(jsonPath("$.save.killStats.arasaka").value(50))
                .andExpect(jsonPath("$.save.characterStats.david.bestTimeSec").value(605))
                .andExpect(jsonPath("$.save.characterStats.david.runs").value(1))
                .andExpect(jsonPath("$.save.codex.enemies", contains("maelstrom", "arasaka")))
                .andExpect(jsonPath("$.save.codex.weapons", contains("pistol", "shotgun")));

        assertThat(expected).isEqualTo(332);
        RunRecord stored = run(runId);
        assertThat(stored.getStatus()).isEqualTo(RunRecord.Status.ENDED);
        assertThat(stored.getDurationSec()).isEqualTo(605);
        assertThat(stored.getKills()).isEqualTo(300);
        assertThat(stored.getLevel()).isEqualTo(20);
        assertThat(stored.getEurodollarsAwarded()).isEqualTo(expected);
        assertThat(stored.getEndedAt()).isNotNull();
        assertThat(stored.getLastCheckpointAt()).isNotNull();

        mvc.perform(get("/api/save").header("Authorization", session.bearer()))
                .andExpect(jsonPath("$.eurodollars").value(expected))
                .andExpect(jsonPath("$.unlockedCharacters", hasItem("maine")));
    }

    @Test
    void secondRunAccumulatesStatsAndUsesGreed() throws Exception {
        Account account = api.registerVerified();
        Session session = api.loginSession(account);
        upgrades.save(new RipperdocUpgrade(userId(account), "greed", 2));
        String first = startRun(session);
        clock.advance(Duration.ofSeconds(610));
        end(session, first, VALID_END).andExpect(status().isOk());
        String second = startRun(session);
        clock.advance(Duration.ofSeconds(130));
        long reward = rewards.compute(120, 40, 2);

        end(session, second, """
                {"characterId":"david","durationSec":120,"kills":40,"killsByEnemy":{"maelstrom":40},
                 "level":5,"eurodollarsCollected":30,"weaponsSeen":["pistol"],"enemiesSeen":["maelstrom"]}""")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.eurodollarsAwarded").value(reward))
                .andExpect(jsonPath("$.newUnlocks", empty()))
                .andExpect(jsonPath("$.save.totalKills").value(340))
                .andExpect(jsonPath("$.save.bestTimeSec").value(605))
                .andExpect(jsonPath("$.save.killStats.maelstrom").value(290))
                .andExpect(jsonPath("$.save.characterStats.david.bestTimeSec").value(605))
                .andExpect(jsonPath("$.save.characterStats.david.runs").value(2))
                .andExpect(jsonPath("$.save.eurodollars").value(rewards.compute(605, 300, 2) + reward));
    }

    @Test
    void endingTwiceIsAConflict() throws Exception {
        Session session = verifiedSession();
        String runId = startRun(session);
        clock.advance(Duration.ofSeconds(610));
        end(session, runId, VALID_END).andExpect(status().isOk());

        end(session, runId, VALID_END)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.title").value("Run non attiva"));
        checkpoint(session, runId, FIRST_CHECKPOINT).andExpect(status().isConflict());
    }

    @Test
    void concurrentEndsLetExactlyOneThrough() throws Exception {
        Session session = verifiedSession();
        String runId = startRun(session);
        clock.advance(Duration.ofSeconds(610));
        CountDownLatch go = new CountDownLatch(1);

        List<CompletableFuture<Integer>> calls = List.of(1, 2, 3).stream()
                .map(i -> CompletableFuture.supplyAsync(() -> {
                    try {
                        go.await();
                        return end(session, runId, VALID_END).andReturn().getResponse().getStatus();
                    } catch (Exception e) {
                        throw new IllegalStateException(e);
                    }
                }))
                .toList();
        go.countDown();

        assertThat(calls.stream().map(CompletableFuture::join)).containsExactlyInAnyOrder(200, 409, 409);
        mvc.perform(get("/api/save").header("Authorization", session.bearer()))
                .andExpect(jsonPath("$.eurodollars").value(rewards.compute(605, 300, 0)))
                .andExpect(jsonPath("$.characterStats.david.runs").value(1));
    }

    @Test
    void runsOfOtherUsersAreNotFound() throws Exception {
        Session owner = verifiedSession();
        Session other = verifiedSession();
        String runId = startRun(owner);
        clock.advance(Duration.ofSeconds(610));

        end(other, runId, VALID_END)
                .andExpect(status().isNotFound())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.title").value("Run non trovata"));
        checkpoint(other, runId, FIRST_CHECKPOINT).andExpect(status().isNotFound());
        assertThat(run(runId).getStatus()).isEqualTo(RunRecord.Status.ACTIVE);
        end(owner, runId, VALID_END).andExpect(status().isOk());
    }

    @Test
    void unknownOrMalformedRunIdsAreNotFound() throws Exception {
        Session session = verifiedSession();
        end(session, UUID.randomUUID().toString(), VALID_END).andExpect(status().isNotFound());
        end(session, "not-a-uuid", VALID_END).andExpect(status().isNotFound());
        checkpoint(session, "not-a-uuid", FIRST_CHECKPOINT).andExpect(status().isNotFound());
    }

    @Test
    void implausibleCheckpointIsRejectedAndTheRunEndsFlagged() throws Exception {
        Account account = api.registerVerified();
        Session session = api.loginSession(account);
        String runId = startRun(session);
        clock.advance(Duration.ofSeconds(10));

        // 60 s of game time after 10 s of real time
        checkpoint(session, runId, FIRST_CHECKPOINT)
                .andExpect(status().isUnprocessableContent())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.title").value("Checkpoint non plausibile"));
        clock.advance(Duration.ofSeconds(600));

        end(session, runId, VALID_END)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.flagged").value(true))
                .andExpect(jsonPath("$.eurodollarsAwarded").value(0))
                .andExpect(jsonPath("$.newUnlocks", empty()))
                .andExpect(jsonPath("$.save.eurodollars").value(0))
                .andExpect(jsonPath("$.save.totalKills").value(0))
                .andExpect(jsonPath("$.save.unlockedCharacters", hasSize(3)));

        RunRecord stored = run(runId);
        assertThat(stored.getStatus()).isEqualTo(RunRecord.Status.FLAGGED);
        assertThat(stored.getEurodollarsAwarded()).isZero();
        assertThat(auditLog.findByUserId(userId(account))).extracting(AuditLog::getEvent)
                .contains(AuditEvent.RUN_FLAGGED);
    }

    @Test
    void implausibleEndIsFlagged() throws Exception {
        Account account = api.registerVerified();
        Session session = api.loginSession(account);
        String runId = startRun(session);
        clock.advance(Duration.ofSeconds(100));

        end(session, runId, VALID_END)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.flagged").value(true))
                .andExpect(jsonPath("$.eurodollarsAwarded").value(0));
        assertThat(auditLog.findByUserId(userId(account))).extracting(AuditLog::getEvent)
                .contains(AuditEvent.RUN_FLAGGED);
    }

    @Test
    void invalidEndBodyIsRejected() throws Exception {
        Session session = verifiedSession();
        String runId = startRun(session);

        end(session, runId, "{\"characterId\":\"david\",\"durationSec\":-1}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.durationSec").isString())
                .andExpect(jsonPath("$.errors.killsByEnemy").isString());
        assertThat(run(runId).getStatus()).isEqualTo(RunRecord.Status.ACTIVE);
    }

    @Test
    void secondStartAbandonsTheActiveRun() throws Exception {
        Session session = verifiedSession();
        String first = startRun(session);
        String second = startRun(session);

        assertThat(run(first).getStatus()).isEqualTo(RunRecord.Status.ABANDONED);
        assertThat(run(first).getEndedAt()).isNotNull();
        assertThat(run(second).getStatus()).isEqualTo(RunRecord.Status.ACTIVE);
        checkpoint(session, first, FIRST_CHECKPOINT).andExpect(status().isConflict());
    }

    @Test
    void concurrentStartsLeaveOneActiveRun() throws Exception {
        Account account = api.registerVerified();
        Session session = api.loginSession(account);
        CountDownLatch go = new CountDownLatch(1);

        List<CompletableFuture<Integer>> calls = List.of(1, 2, 3, 4).stream()
                .map(i -> CompletableFuture.supplyAsync(() -> {
                    try {
                        go.await();
                        return start(session, "david").andReturn().getResponse().getStatus();
                    } catch (Exception e) {
                        throw new IllegalStateException(e);
                    }
                }))
                .toList();
        go.countDown();

        assertThat(calls.stream().map(CompletableFuture::join)).containsOnly(201);
        assertThat(runs.findByUserId(userId(account))).extracting(RunRecord::getStatus)
                .containsExactlyInAnyOrder(RunRecord.Status.ACTIVE, RunRecord.Status.ABANDONED,
                        RunRecord.Status.ABANDONED, RunRecord.Status.ABANDONED);
    }

    @Test
    void bestReturnsTheTenLongestEndedRuns() throws Exception {
        Account account = api.registerVerified();
        Session session = api.loginSession(account);
        UUID id = userId(account);
        Instant now = Instant.now();
        for (int i = 1; i <= 12; i++) {
            runs.save(ended(id, i * 100, RunRecord.Status.ENDED, now));
        }
        runs.save(ended(id, 5000, RunRecord.Status.FLAGGED, now));
        runs.save(ended(id, 6000, RunRecord.Status.ABANDONED, now));
        runs.save(ended(userId(api.register()), 7000, RunRecord.Status.ENDED, now));

        mvc.perform(get("/api/runs/best").header("Authorization", session.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(10)))
                .andExpect(jsonPath("$[0].durationSec").value(1200))
                .andExpect(jsonPath("$[9].durationSec").value(300))
                .andExpect(jsonPath("$[0].characterId").value("david"))
                .andExpect(jsonPath("$[0].kills").value(1200))
                .andExpect(jsonPath("$[0].level").value(12))
                .andExpect(jsonPath("$[0].id").isString())
                .andExpect(jsonPath("$[0].endedAt").isString());
    }

    @Test
    void bestIsEmptyForANewPlayer() throws Exception {
        mvc.perform(get("/api/runs/best").header("Authorization", verifiedSession().bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", empty()));
    }

    private static RunRecord ended(UUID userId, int durationSec, RunRecord.Status status, Instant now) {
        RunRecord run = new RunRecord(userId, "david", 1, now.minusSeconds(durationSec + 10));
        run.setStatus(status);
        run.setDurationSec(durationSec);
        run.setKills((long) durationSec);
        run.setLevel(durationSec / 100);
        run.setEndedAt(now);
        return run;
    }
}
