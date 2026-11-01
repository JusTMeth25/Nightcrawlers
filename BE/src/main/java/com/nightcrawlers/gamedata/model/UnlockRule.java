package com.nightcrawlers.gamedata.model;

import com.fasterxml.jackson.annotation.JsonSubTypes;
import com.fasterxml.jackson.annotation.JsonTypeInfo;

/** Character unlock requirement, selected by the {@code type} property of unlocks.json. */
@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, property = "type")
@JsonSubTypes({
        @JsonSubTypes.Type(value = UnlockRule.Survive.class, name = "survive"),
        @JsonSubTypes.Type(value = UnlockRule.Kills.class, name = "kills"),
        @JsonSubTypes.Type(value = UnlockRule.EurodollarsTotal.class, name = "eurodollars_total"),
        @JsonSubTypes.Type(value = UnlockRule.SurviveWith.class, name = "survive_with"),
        @JsonSubTypes.Type(value = UnlockRule.DistinctCharacters.class, name = "distinct_characters") })
public sealed interface UnlockRule {

    /** Best run of at least {@code seconds}, any character. */
    record Survive(int seconds) implements UnlockRule {
    }

    /** At least {@code count} total kills of {@code enemyId}. */
    record Kills(String enemyId, long count) implements UnlockRule {
    }

    /** At least {@code amount} €$ earned in total. */
    record EurodollarsTotal(long amount) implements UnlockRule {
    }

    /** Best run of at least {@code seconds} with {@code characterId}. */
    record SurviveWith(String characterId, int seconds) implements UnlockRule {
    }

    /** At least {@code count} different characters with a best run of {@code seconds} or more. */
    record DistinctCharacters(int count, int seconds) implements UnlockRule {
    }
}
