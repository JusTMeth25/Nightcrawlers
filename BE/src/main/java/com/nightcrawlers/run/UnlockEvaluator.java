package com.nightcrawlers.run;

import java.util.List;
import java.util.Map;
import java.util.Set;

import org.springframework.stereotype.Component;

import com.nightcrawlers.gamedata.GameData;
import com.nightcrawlers.gamedata.model.UnlockDef;
import com.nightcrawlers.gamedata.model.UnlockRule;

/** Character unlocks (unlocks.json), evaluated by the server on the progress after a run. */
@Component
public class UnlockEvaluator {

    /** Totals after the run has been applied; {@code characterBestTimes}: character id -> best seconds. */
    public record Progress(int bestTimeSec, Map<String, Long> killStats, long totalEurodollarsEarned,
            Map<String, Integer> characterBestTimes) {
    }

    private final GameData gameData;

    public UnlockEvaluator(GameData gameData) {
        this.gameData = gameData;
    }

    /** Newly met unlocks, in unlocks.json order, excluding characters already unlocked. */
    public List<String> newUnlocks(Progress progress, Set<String> alreadyUnlocked) {
        return gameData.unlocks().stream()
                .filter(u -> !alreadyUnlocked.contains(u.characterId()))
                .filter(u -> met(u, progress))
                .map(UnlockDef::characterId)
                .toList();
    }

    private static boolean met(UnlockDef unlock, Progress p) {
        return switch (unlock.rule()) {
            case UnlockRule.Survive s -> p.bestTimeSec() >= s.seconds();
            case UnlockRule.Kills k -> p.killStats().getOrDefault(k.enemyId(), 0L) >= k.count();
            case UnlockRule.EurodollarsTotal e -> p.totalEurodollarsEarned() >= e.amount();
            case UnlockRule.SurviveWith s -> p.characterBestTimes().getOrDefault(s.characterId(), 0) >= s.seconds();
            case UnlockRule.DistinctCharacters d -> p.characterBestTimes().values().stream()
                    .filter(best -> best >= d.seconds()).count() >= d.count();
        };
    }
}
