package com.nightcrawlers.gamedata.model;

/** Unlock requirement of a character. */
public record UnlockDef(String characterId, UnlockRule rule, String description) {
}
