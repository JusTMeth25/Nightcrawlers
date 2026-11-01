package com.nightcrawlers.gamedata.model;

/**
 * Plausibility limits (balance.json antiCheat). Rates are measured over windows of at least
 * {@code checkpointEverySec}; the €$ cap of a window also grows by {@code maxEurodollarsPerKill}
 * for each kill in it.
 */
public record AntiCheat(double clockSkewSec, double maxKillsPerSec, double maxLevelPerMinute,
        double maxEurodollarsPerMinute, double checkpointEverySec, double maxEurodollarsPerKill) {
}
