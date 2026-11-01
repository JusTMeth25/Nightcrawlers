package com.nightcrawlers.save;

import static org.hamcrest.Matchers.anEmptyMap;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.empty;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import com.nightcrawlers.support.CapturingMailService;
import com.nightcrawlers.support.IntegrationTest;
import com.nightcrawlers.support.MutableClock;
import com.nightcrawlers.support.TestApi;
import com.nightcrawlers.support.TestApi.Account;
import com.nightcrawlers.user.UserRepository;

@IntegrationTest
class SaveIT {

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
    UnlockedCharacterRepository unlocked;
    @Autowired
    RipperdocUpgradeRepository upgrades;
    @Autowired
    EnemyKillStatRepository kills;
    @Autowired
    CharacterStatRepository characterStats;
    @Autowired
    CodexEntryRepository codex;

    TestApi api;

    @BeforeEach
    void setUp() {
        clock.reset();
        api = new TestApi(mvc, mail);
    }

    @Test
    void newUserHasAnEmptySaveWithTheStarters() throws Exception {
        TestApi.Session session = api.loginSession(api.register());

        mvc.perform(get("/api/save").header("Authorization", session.bearer()))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.eurodollars").value(0))
                .andExpect(jsonPath("$.totalEurodollarsEarned").value(0))
                .andExpect(jsonPath("$.totalKills").value(0))
                .andExpect(jsonPath("$.bestTimeSec").value(0))
                .andExpect(jsonPath("$.unlockedCharacters", contains("david", "lucy", "rebecca")))
                .andExpect(jsonPath("$.ripperdoc", anEmptyMap()))
                .andExpect(jsonPath("$.killStats", anEmptyMap()))
                .andExpect(jsonPath("$.characterStats", anEmptyMap()))
                .andExpect(jsonPath("$.codex.enemies", empty()))
                .andExpect(jsonPath("$.codex.weapons", empty()));
    }

    @Test
    void saveReflectsStoredProgress() throws Exception {
        Account account = api.register();
        UUID id = users.findByEmail(account.email()).orElseThrow().getId();
        PlayerSave save = saves.findById(id).orElseThrow();
        save.setEurodollars(1234);
        save.setTotalEurodollarsEarned(5000);
        save.setTotalKills(321);
        save.setBestTimeSec(615);
        saves.save(save);
        Instant now = Instant.now();
        unlocked.save(new UnlockedCharacter(id, "maine", now));
        upgrades.save(new RipperdocUpgrade(id, "greed", 2));
        kills.save(new EnemyKillStat(id, "maxtac", 50));
        kills.save(new EnemyKillStat(id, "maelstrom", 271));
        characterStats.save(new CharacterStat(id, "david", 615, 3));
        codex.save(new CodexEntry(id, CodexEntry.Type.ENEMY, "maxtac", now));
        codex.save(new CodexEntry(id, CodexEntry.Type.ENEMY, "maelstrom", now));
        codex.save(new CodexEntry(id, CodexEntry.Type.WEAPON, "pistol", now));
        TestApi.Session session = api.loginSession(account);

        mvc.perform(get("/api/save").header("Authorization", session.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.eurodollars").value(1234))
                .andExpect(jsonPath("$.totalEurodollarsEarned").value(5000))
                .andExpect(jsonPath("$.totalKills").value(321))
                .andExpect(jsonPath("$.bestTimeSec").value(615))
                .andExpect(jsonPath("$.unlockedCharacters", contains("david", "lucy", "rebecca", "maine")))
                .andExpect(jsonPath("$.ripperdoc.greed").value(2))
                .andExpect(jsonPath("$.killStats.maxtac").value(50))
                .andExpect(jsonPath("$.killStats.maelstrom").value(271))
                .andExpect(jsonPath("$.characterStats.david.bestTimeSec").value(615))
                .andExpect(jsonPath("$.characterStats.david.runs").value(3))
                .andExpect(jsonPath("$.codex.enemies", contains("maelstrom", "maxtac")))
                .andExpect(jsonPath("$.codex.weapons", contains("pistol")));
    }

    @Test
    void saveRequiresAuthentication() throws Exception {
        mvc.perform(get("/api/save"))
                .andExpect(status().isUnauthorized())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON));
    }
}
