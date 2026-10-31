package com.nightcrawlers.save;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** Creates the empty save of a new account: 0 €$ and the starter characters. */
@Component
public class SaveInitializer {

    static final List<String> STARTERS = List.of("david", "lucy", "rebecca");

    private final PlayerSaveRepository saves;
    private final UnlockedCharacterRepository unlocked;

    public SaveInitializer(PlayerSaveRepository saves, UnlockedCharacterRepository unlocked) {
        this.saves = saves;
        this.unlocked = unlocked;
    }

    @Transactional
    public void createFor(UUID userId, Instant now) {
        saves.save(new PlayerSave(userId));
        for (String characterId : STARTERS) {
            unlocked.save(new UnlockedCharacter(userId, characterId, now));
        }
    }
}
