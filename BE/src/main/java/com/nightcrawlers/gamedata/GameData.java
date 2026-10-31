package com.nightcrawlers.gamedata;

import java.io.IOException;
import java.io.InputStream;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

import com.nightcrawlers.gamedata.model.AntiCheat;
import com.nightcrawlers.gamedata.model.Balance;
import com.nightcrawlers.gamedata.model.CharacterDef;
import com.nightcrawlers.gamedata.model.EnemyDef;
import com.nightcrawlers.gamedata.model.Reward;
import com.nightcrawlers.gamedata.model.RipperdocDef;
import com.nightcrawlers.gamedata.model.UnlockDef;
import com.nightcrawlers.gamedata.model.UnlockRule;
import com.nightcrawlers.gamedata.model.WeaponDef;

import tools.jackson.core.JacksonException;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.DeserializationFeature;
import tools.jackson.databind.json.JsonMapper;

/**
 * Shared game data from {@code classpath:gamedata/*.json} (copied from {@code FE/src/data} by
 * the sync script). Unknown properties are ignored; a missing or inconsistent file stops startup.
 */
public final class GameData {

    private static final JsonMapper MAPPER = JsonMapper.builder()
            .disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
            .enable(DeserializationFeature.FAIL_ON_NULL_FOR_PRIMITIVES)
            .enable(DeserializationFeature.FAIL_ON_MISSING_CREATOR_PROPERTIES)
            .build();

    private final List<CharacterDef> characters;
    private final Set<String> characterIds;
    private final Set<String> enemyIds;
    private final Set<String> weaponIds;
    private final List<UnlockDef> unlocks;
    private final Map<String, RipperdocDef> ripperdoc;
    private final Balance balance;

    private GameData(List<CharacterDef> characters, List<EnemyDef> enemies, List<WeaponDef> weapons,
            List<UnlockDef> unlocks, List<RipperdocDef> ripperdoc, Balance balance) {
        this.characters = List.copyOf(characters);
        this.characterIds = ids(characters, CharacterDef::id, "characters");
        this.enemyIds = ids(enemies, EnemyDef::id, "enemies");
        this.weaponIds = ids(weapons, WeaponDef::id, "weapons");
        this.unlocks = List.copyOf(unlocks);
        Map<String, RipperdocDef> byId = new LinkedHashMap<>();
        for (RipperdocDef def : ripperdoc) {
            require(def.id() != null && !def.id().isBlank(), "ripperdoc: missing id");
            require(def.maxRank() >= 1 && def.baseCost() > 0 && def.costGrowth() >= 1,
                    "ripperdoc " + def.id() + ": invalid maxRank/baseCost/costGrowth");
            require(byId.put(def.id(), def) == null, "ripperdoc: duplicate id " + def.id());
        }
        this.ripperdoc = Map.copyOf(byId);
        this.balance = balance;
        validate();
    }

    /** Loads the six files from a classpath directory such as {@code "gamedata/"}. */
    public static GameData load(String classpathDir) {
        return new GameData(
                read(classpathDir, "characters.json", new TypeReference<List<CharacterDef>>() { }),
                read(classpathDir, "enemies.json", new TypeReference<List<EnemyDef>>() { }),
                read(classpathDir, "weapons.json", new TypeReference<List<WeaponDef>>() { }),
                read(classpathDir, "unlocks.json", new TypeReference<List<UnlockDef>>() { }),
                read(classpathDir, "ripperdoc.json", new TypeReference<List<RipperdocDef>>() { }),
                read(classpathDir, "balance.json", new TypeReference<Balance>() { }));
    }

    public boolean isCharacter(String id) {
        return id != null && characterIds.contains(id);
    }

    public boolean isEnemy(String id) {
        return id != null && enemyIds.contains(id);
    }

    public boolean isWeapon(String id) {
        return id != null && weaponIds.contains(id);
    }

    public List<String> starters() {
        return characters.stream().filter(CharacterDef::starter).map(CharacterDef::id).toList();
    }

    public List<UnlockDef> unlocks() {
        return unlocks;
    }

    public Optional<RipperdocDef> ripperdoc(String id) {
        return Optional.ofNullable(id == null ? null : ripperdoc.get(id));
    }

    /** Price of the next rank: {@code round(baseCost * costGrowth ^ currentRank)}. */
    public long ripperdocCost(RipperdocDef def, int currentRank) {
        return Math.round(def.baseCost() * Math.pow(def.costGrowth(), currentRank));
    }

    public Reward reward() {
        return balance.reward();
    }

    public AntiCheat antiCheat() {
        return balance.antiCheat();
    }

    private void validate() {
        require(!starters().isEmpty(), "characters: no starter");
        require(balance != null && balance.reward() != null && balance.antiCheat() != null,
                "balance: missing reward or antiCheat block");
        Set<String> unlockable = characters.stream().filter(c -> !c.starter()).map(CharacterDef::id)
                .collect(Collectors.toSet());
        for (UnlockDef unlock : unlocks) {
            require(unlock.rule() != null, "unlocks: missing rule for " + unlock.characterId());
            require(unlockable.contains(unlock.characterId()),
                    "unlocks: " + unlock.characterId() + " is not an unlockable character");
            switch (unlock.rule()) {
                case UnlockRule.Kills k -> require(isEnemy(k.enemyId()), "unlocks: unknown enemy " + k.enemyId());
                case UnlockRule.SurviveWith s -> require(isCharacter(s.characterId()),
                        "unlocks: unknown character " + s.characterId());
                case UnlockRule.Survive s -> require(s.seconds() > 0, "unlocks: survive seconds must be > 0");
                case UnlockRule.EurodollarsTotal e -> require(e.amount() > 0, "unlocks: amount must be > 0");
                case UnlockRule.DistinctCharacters d -> require(d.count() > 0, "unlocks: count must be > 0");
            }
        }
    }

    private static <T> Set<String> ids(List<T> items, Function<T, String> id, String file) {
        require(!items.isEmpty(), file + ": empty");
        List<String> list = items.stream().map(id).toList();
        require(list.stream().allMatch(i -> i != null && !i.isBlank()), file + ": missing id");
        Set<String> set = Set.copyOf(list);
        require(set.size() == list.size(), file + ": duplicate id");
        return set;
    }

    private static <T> T read(String dir, String file, TypeReference<T> type) {
        String path = "/" + dir + file;
        try (InputStream in = GameData.class.getResourceAsStream(path)) {
            if (in == null) {
                throw new IllegalStateException("Game data file not found: classpath:" + dir + file);
            }
            return Objects.requireNonNull(MAPPER.readValue(in, type), file + " is empty");
        } catch (IOException | JacksonException | NullPointerException e) {
            throw new IllegalStateException("Invalid game data file " + file + ": " + e.getMessage(), e);
        }
    }

    private static void require(boolean condition, String message) {
        if (!condition) {
            throw new IllegalStateException("Invalid game data: " + message);
        }
    }
}
