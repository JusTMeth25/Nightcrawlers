package com.nightcrawlers.gamedata.model;

/** Plausibility limits (balance.json antiCheat). */
public record AntiCheat(double clockSkewSec, double maxKillsPerSec, double maxLevelPerMinute, double maxEurodollarsPerMinute, double checkpointEverySec) {
}
