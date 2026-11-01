package com.nightcrawlers.save;

import java.util.List;
import java.util.Map;

/** Contract {@code SaveDto}: maps and lists are never null. */
public record SaveDto(
        long eurodollars,
        long totalEurodollarsEarned,
        long totalKills,
        int bestTimeSec,
        List<String> unlockedCharacters,
        Map<String, Integer> ripperdoc,
        Map<String, Long> killStats,
        Map<String, CharacterStatDto> characterStats,
        CodexDto codex) {

    public record CharacterStatDto(int bestTimeSec, long runs) {
    }

    public record CodexDto(List<String> enemies, List<String> weapons) {
    }
}
