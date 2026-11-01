package com.nightcrawlers.ripperdoc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import com.nightcrawlers.common.audit.AuditEvent;
import com.nightcrawlers.common.audit.AuditLog;
import com.nightcrawlers.common.audit.AuditLogRepository;
import com.nightcrawlers.save.PlayerSave;
import com.nightcrawlers.save.PlayerSaveRepository;
import com.nightcrawlers.save.RipperdocUpgrade;
import com.nightcrawlers.save.RipperdocUpgradeRepository;
import com.nightcrawlers.support.CapturingMailService;
import com.nightcrawlers.support.IntegrationTest;
import com.nightcrawlers.support.MutableClock;
import com.nightcrawlers.support.TestApi;
import com.nightcrawlers.support.TestApi.Account;
import com.nightcrawlers.support.TestApi.Session;
import com.nightcrawlers.user.UserRepository;

/** ripperdoc.json: max_hp 200 x1.6 (5 ranks), magnet 150 x1.5 (3 ranks), revival 5000 (1 rank). */
@IntegrationTest
class RipperdocIT {

    @Autowired
    MockMvc mvc;
    @Autowired
    CapturingMailService mail;
    @Autowired
    MutableClock clock;
    @Autowired
    UserRepository users;
    @Autowired
    PlayerSaveRepository saves;
    @Autowired
    RipperdocUpgradeRepository upgrades;
    @Autowired
    AuditLogRepository auditLog;

    TestApi api;

    @BeforeEach
    void setUp() {
        clock.reset();
        api = new TestApi(mvc, mail);
    }

    record Player(UUID id, Session session) {
    }

    private Player player(long eurodollars) throws Exception {
        Account account = api.registerVerified();
        UUID id = users.findByEmail(account.email()).orElseThrow().getId();
        PlayerSave save = saves.findById(id).orElseThrow();
        save.setEurodollars(eurodollars);
        saves.save(save);
        return new Player(id, api.loginSession(account));
    }

    private ResultActions buy(Session session, String upgradeId) throws Exception {
        return mvc.perform(post("/api/ripperdoc/" + upgradeId + "/buy").header("Authorization", session.bearer()));
    }

    private long balance(Player player) {
        return saves.findById(player.id()).orElseThrow().getEurodollars();
    }

    private int rank(Player player, String upgradeId) {
        return upgrades.findById(new RipperdocUpgrade.Key(player.id(), upgradeId)).map(RipperdocUpgrade::getRank)
                .orElse(0);
    }

    @Test
    void purchaseSpendsTheCostAndRaisesTheRank() throws Exception {
        Player player = player(1000);

        buy(player.session(), "max_hp")
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.eurodollars").value(800))
                .andExpect(jsonPath("$.ripperdoc.max_hp").value(1))
                .andExpect(jsonPath("$.unlockedCharacters").isArray());
        // second rank: round(200 * 1.6) = 320
        buy(player.session(), "max_hp")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.eurodollars").value(480))
                .andExpect(jsonPath("$.ripperdoc.max_hp").value(2));

        assertThat(auditLog.findByUserId(player.id())).extracting(AuditLog::getEvent)
                .filteredOn(e -> e == AuditEvent.RIPPERDOC_PURCHASE).hasSize(2);
    }

    @Test
    void notEnoughEurodollarsIsAConflict() throws Exception {
        Player player = player(199);

        buy(player.session(), "max_hp")
                .andExpect(status().isConflict())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.title").value("Eurodollari insufficienti"));
        assertThat(balance(player)).isEqualTo(199);
        assertThat(rank(player, "max_hp")).isZero();
    }

    @Test
    void maximumRankIsAConflict() throws Exception {
        Player player = player(20_000);
        buy(player.session(), "revival").andExpect(status().isOk());

        buy(player.session(), "revival")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.title").value("Grado massimo raggiunto"));
        assertThat(balance(player)).isEqualTo(15_000);
        assertThat(rank(player, "revival")).isEqualTo(1);
    }

    @Test
    void unknownUpgradeIsNotFound() throws Exception {
        Player player = player(1000);

        buy(player.session(), "nope")
                .andExpect(status().isNotFound())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON));
        assertThat(balance(player)).isEqualTo(1000);
    }

    @Test
    void unverifiedEmailIsForbidden() throws Exception {
        Session session = api.loginSession(api.register());

        buy(session, "max_hp")
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.title").value("Email non verificata"));
    }

    @Test
    void purchaseRequiresAuthentication() throws Exception {
        mvc.perform(post("/api/ripperdoc/max_hp/buy")).andExpect(status().isUnauthorized());
    }

    @Test
    void concurrentPurchasesOfTheSameUpgradeWithMoneyForOne() throws Exception {
        Player player = player(300);

        List<Integer> statuses = concurrently(player, "max_hp", "max_hp");

        assertThat(statuses).containsExactlyInAnyOrder(200, 409);
        assertThat(balance(player)).isEqualTo(100);
        assertThat(rank(player, "max_hp")).isEqualTo(1);
    }

    @Test
    void concurrentPurchasesOfDifferentUpgradesWithMoneyForOne() throws Exception {
        Player player = player(300);

        List<Integer> statuses = concurrently(player, "max_hp", "magnet");

        assertThat(statuses).containsExactlyInAnyOrder(200, 409);
        assertThat(balance(player)).isIn(100L, 150L);
        assertThat(rank(player, "max_hp") + rank(player, "magnet")).isEqualTo(1);
    }

    @Test
    void concurrentPurchasesWithMoneyForBothBothSucceed() throws Exception {
        Player player = player(1000);

        List<Integer> statuses = concurrently(player, "max_hp", "magnet");

        assertThat(statuses).containsExactly(200, 200);
        assertThat(balance(player)).isEqualTo(650);
        assertThat(rank(player, "max_hp")).isEqualTo(1);
        assertThat(rank(player, "magnet")).isEqualTo(1);
    }

    private List<Integer> concurrently(Player player, String... upgradeIds) {
        CountDownLatch go = new CountDownLatch(1);
        List<CompletableFuture<Integer>> calls = List.of(upgradeIds).stream()
                .map(id -> CompletableFuture.supplyAsync(() -> {
                    try {
                        go.await();
                        return buy(player.session(), id).andReturn().getResponse().getStatus();
                    } catch (Exception e) {
                        throw new IllegalStateException(e);
                    }
                }))
                .toList();
        go.countDown();
        return calls.stream().map(CompletableFuture::join).toList();
    }
}
