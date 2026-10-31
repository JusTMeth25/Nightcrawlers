package com.nightcrawlers.save;

import java.time.Instant;
import java.util.UUID;

import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.nightcrawlers.gamedata.GameData;

/** Creates the empty save of a new account: 0 €$ and the starter characters. */
@Component
public class SaveInitializer {

    private final PlayerSaveRepository saves;
    private final UnlockedCharacterRepository unlocked;
    private final GameData gameData;

    public SaveInitializer(PlayerSaveRepository saves, UnlockedCharacterRepository unlocked, GameData gameData) {
        this.saves = saves;
        this.unlocked = unlocked;
        this.gameData = gameData;
    }

    @Transactional
    public void createFor(UUID userId, Instant now) {
        saves.save(new PlayerSave(userId));
        for (String characterId : gameData.starters()) {
            unlocked.save(new UnlockedCharacter(userId, characterId, now));
        }
    }
}
