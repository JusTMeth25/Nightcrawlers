package com.nightcrawlers.save;

import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.nightcrawlers.common.ApiException;
import com.nightcrawlers.gamedata.GameData;
import com.nightcrawlers.save.SaveDto.CharacterStatDto;
import com.nightcrawlers.save.SaveDto.CodexDto;

@Service
public class SaveService {

    private final PlayerSaveRepository saves;
    private final UnlockedCharacterRepository unlocked;
    private final RipperdocUpgradeRepository upgrades;
    private final EnemyKillStatRepository kills;
    private final CharacterStatRepository characterStats;
    private final CodexEntryRepository codex;
    private final GameData gameData;

    public SaveService(PlayerSaveRepository saves, UnlockedCharacterRepository unlocked,
            RipperdocUpgradeRepository upgrades, EnemyKillStatRepository kills,
            CharacterStatRepository characterStats, CodexEntryRepository codex, GameData gameData) {
        this.saves = saves;
        this.unlocked = unlocked;
        this.upgrades = upgrades;
        this.kills = kills;
        this.characterStats = characterStats;
        this.codex = codex;
        this.gameData = gameData;
    }

    /** The full save, ids ordered as in the game data files. */
    @Transactional(readOnly = true)
    public SaveDto load(UUID userId) {
        PlayerSave save = saves.findById(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Salvataggio non trovato"));

        Map<String, Integer> ripperdoc = new LinkedHashMap<>();
        upgrades.findByUserId(userId).stream()
                .sorted(Comparator.comparing(RipperdocUpgrade::getUpgradeId))
                .forEach(u -> ripperdoc.put(u.getUpgradeId(), u.getRank()));

        Map<String, Long> killStats = new LinkedHashMap<>();
        sorted(kills.findByUserId(userId), EnemyKillStat::getEnemyId, gameData.enemyIds())
                .forEach(k -> killStats.put(k.getEnemyId(), k.getCount()));

        Map<String, CharacterStatDto> stats = new LinkedHashMap<>();
        sorted(characterStats.findByUserId(userId), CharacterStat::getCharacterId, gameData.characterIds())
                .forEach(c -> stats.put(c.getCharacterId(), new CharacterStatDto(c.getBestTimeSec(), c.getRuns())));

        List<CodexEntry> entries = codex.findByUserId(userId);
        List<String> enemies = sorted(entries.stream().filter(e -> e.getEntryType() == CodexEntry.Type.ENEMY).toList(),
                CodexEntry::getEntryId, gameData.enemyIds()).stream().map(CodexEntry::getEntryId).toList();
        List<String> weapons = sorted(entries.stream().filter(e -> e.getEntryType() == CodexEntry.Type.WEAPON).toList(),
                CodexEntry::getEntryId, gameData.weaponIds()).stream().map(CodexEntry::getEntryId).toList();

        List<String> characters = sorted(unlocked.findByUserId(userId), UnlockedCharacter::getCharacterId,
                gameData.characterIds()).stream().map(UnlockedCharacter::getCharacterId).toList();

        return new SaveDto(save.getEurodollars(), save.getTotalEurodollarsEarned(), save.getTotalKills(),
                save.getBestTimeSec(), characters, ripperdoc, killStats, stats, new CodexDto(enemies, weapons));
    }

    /** Orders by position in the game data; ids no longer in the data go last, alphabetically. */
    static <T> List<T> sorted(Collection<T> items, Function<T, String> id, List<String> order) {
        Comparator<T> byPosition = Comparator.comparingInt(t -> {
            int index = order.indexOf(id.apply(t));
            return index < 0 ? Integer.MAX_VALUE : index;
        });
        return items.stream().sorted(byPosition.thenComparing(id)).toList();
    }
}
