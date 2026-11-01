package com.nightcrawlers.user;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import com.nightcrawlers.auth.RefreshTokenRepository;
import com.nightcrawlers.common.audit.AuditEvent;
import com.nightcrawlers.common.audit.AuditLogRepository;
import com.nightcrawlers.run.RunCheckpoint;
import com.nightcrawlers.run.RunCheckpointRepository;
import com.nightcrawlers.run.RunRecord;
import com.nightcrawlers.run.RunRecordRepository;
import com.nightcrawlers.save.CharacterStat;
import com.nightcrawlers.save.CharacterStatRepository;
import com.nightcrawlers.save.CodexEntry;
import com.nightcrawlers.save.CodexEntryRepository;
import com.nightcrawlers.save.EnemyKillStat;
import com.nightcrawlers.save.EnemyKillStatRepository;
import com.nightcrawlers.save.RipperdocUpgrade;
import com.nightcrawlers.save.RipperdocUpgradeRepository;
import com.nightcrawlers.support.CapturingMailService;
import com.nightcrawlers.support.IntegrationTest;
import com.nightcrawlers.support.MutableClock;
import com.nightcrawlers.support.TestApi;
import com.nightcrawlers.support.TestApi.Account;
import com.nightcrawlers.support.TestApi.Session;

@IntegrationTest
class AccountIT {

    static final List<String> USER_TABLES = List.of("refresh_tokens", "email_tokens", "player_saves",
            "unlocked_characters", "ripperdoc_upgrades", "enemy_kill_stats", "character_stats", "codex_entries",
            "runs", "audit_log");

    @Autowired
    MockMvc mvc;
    @Autowired
    CapturingMailService mail;
    @Autowired
    MutableClock clock;
    @Autowired
    UserRepository users;
    @Autowired
    RefreshTokenRepository refreshTokens;
    @Autowired
    RunRecordRepository runs;
    @Autowired
    RunCheckpointRepository checkpoints;
    @Autowired
    RipperdocUpgradeRepository upgrades;
    @Autowired
    EnemyKillStatRepository kills;
    @Autowired
    CharacterStatRepository characterStats;
    @Autowired
    CodexEntryRepository codex;
    @Autowired
    AuditLogRepository auditLog;
    @Autowired
    JdbcTemplate jdbc;

    TestApi api;

    @BeforeEach
    void setUp() {
        clock.reset();
        api = new TestApi(mvc, mail);
    }

    record Player(Account account, UUID id, Session session) {
    }

    /** A verified player with progress in every table. */
    private Player playerWithProgress() throws Exception {
        Account account = api.registerVerified();
        UUID id = users.findByEmail(account.email()).orElseThrow().getId();
        Session session = api.loginSession(account);
        Instant now = Instant.now();
        RunRecord run = new RunRecord(id, "david", 7, now.minusSeconds(700));
        run.setStatus(RunRecord.Status.ENDED);
        run.setDurationSec(650);
        run.setKills(300L);
        run.setLevel(12);
        run.setEndedAt(now);
        runs.save(run);
        checkpoints.save(new RunCheckpoint(run.getId(), now.minusSeconds(600), 60, 90, 4, 30));
        upgrades.save(new RipperdocUpgrade(id, "greed", 1));
        kills.save(new EnemyKillStat(id, "maxtac", 12));
        characterStats.save(new CharacterStat(id, "david", 650, 1));
        codex.save(new CodexEntry(id, CodexEntry.Type.ENEMY, "maxtac", now));
        return new Player(account, id, session);
    }

    private ResultActions deleteMe(Session session, String password) throws Exception {
        return mvc.perform(delete("/api/me").header("Authorization", session.bearer())
                .contentType(MediaType.APPLICATION_JSON).content("{\"password\":\"" + password + "\"}"));
    }

    private int rows(String table, UUID userId) {
        Integer count = jdbc.queryForObject("SELECT count(*) FROM " + table + " WHERE user_id = ?", Integer.class,
                userId);
        return count == null ? 0 : count;
    }

    @Test
    void exportContainsAllPersonalDataButNoHashes() throws Exception {
        Player player = playerWithProgress();
        User user = users.findById(player.id()).orElseThrow();
        String tokenHash = refreshTokens.findByUserId(player.id()).getFirst().getTokenHash();

        MockHttpServletResponse response = mvc.perform(get("/api/me/export")
                        .header("Authorization", player.session().bearer()))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(header().string("Content-Disposition",
                        "attachment; filename=\"nightcrawlers-export.json\""))
                .andExpect(jsonPath("$.exportedAt").isString())
                .andExpect(jsonPath("$.profile.id").value(player.id().toString()))
                .andExpect(jsonPath("$.profile.username").value(player.account().username()))
                .andExpect(jsonPath("$.profile.email").value(player.account().email()))
                .andExpect(jsonPath("$.profile.emailVerified").value(true))
                .andExpect(jsonPath("$.save.ripperdoc.greed").value(1))
                .andExpect(jsonPath("$.save.killStats.maxtac").value(12))
                .andExpect(jsonPath("$.runs", hasSize(1)))
                .andExpect(jsonPath("$.runs[0].durationSec").value(650))
                .andExpect(jsonPath("$.runs[0].seed").value(7))
                .andExpect(jsonPath("$.runs[0].checkpoints", hasSize(1)))
                .andExpect(jsonPath("$.runs[0].checkpoints[0].kills").value(90))
                .andExpect(jsonPath("$.sessions", hasSize(1)))
                .andExpect(jsonPath("$.sessions[0].createdAt").isString())
                .andExpect(jsonPath("$.sessions[0].expiresAt").isString())
                .andExpect(jsonPath("$.auditLog").isArray())
                .andReturn().getResponse();

        String body = response.getContentAsString();
        assertThat(body).doesNotContainIgnoringCase("hash")
                .doesNotContain(user.getPasswordHash())
                .doesNotContain(tokenHash)
                .doesNotContain(player.session().refreshToken());
    }

    @Test
    void exportRequiresAuthentication() throws Exception {
        mvc.perform(get("/api/me/export")).andExpect(status().isUnauthorized());
    }

    @Test
    void deleteWithAWrongPasswordIsForbiddenAndKeepsTheAccount() throws Exception {
        Player player = playerWithProgress();

        deleteMe(player.session(), "Wrong-password-123")
                .andExpect(status().isForbidden())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.title").value("Password errata"));

        assertThat(users.findById(player.id())).isPresent();
        assertThat(rows("runs", player.id())).isEqualTo(1);
    }

    @Test
    void deleteRequiresAPassword() throws Exception {
        Player player = playerWithProgress();

        mvc.perform(delete("/api/me").header("Authorization", player.session().bearer())
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.password").isString());
        assertThat(users.findById(player.id())).isPresent();
    }

    @Test
    void deleteRequiresAuthentication() throws Exception {
        mvc.perform(delete("/api/me").contentType(MediaType.APPLICATION_JSON).content("{\"password\":\"x\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void deleteRemovesEveryRowAndClearsTheCookies() throws Exception {
        Player player = playerWithProgress();
        UUID runId = runs.findByUserId(player.id()).getFirst().getId();
        long deletionsBefore = auditLog.countByEvent(AuditEvent.ACCOUNT_DELETED);
        assertThat(rows("audit_log", player.id())).isPositive();

        MockHttpServletResponse response = deleteMe(player.session(), player.account().password())
                .andExpect(status().isNoContent())
                .andReturn().getResponse();

        assertThat(TestApi.setCookie(response, "refresh_token").orElseThrow())
                .contains("Max-Age=0", "Path=/api/auth");
        assertThat(TestApi.setCookie(response, "XSRF-TOKEN").orElseThrow()).contains("Max-Age=0");
        assertThat(users.findById(player.id())).isEmpty();
        for (String table : USER_TABLES) {
            assertThat(rows(table, player.id())).as(table).isZero();
        }
        assertThat(jdbc.queryForObject("SELECT count(*) FROM run_checkpoints WHERE run_id = ?", Integer.class,
                runId)).isZero();
        // the audit trail survives, detached from the deleted account
        assertThat(auditLog.countByEvent(AuditEvent.ACCOUNT_DELETED)).isEqualTo(deletionsBefore + 1);
        assertThat(auditLog.countByEvent(AuditEvent.REGISTER)).isPositive();

        api.login(player.account().username(), player.account().password()).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/me").header("Authorization", player.session().bearer()))
                .andExpect(status().isUnauthorized());
    }
}
