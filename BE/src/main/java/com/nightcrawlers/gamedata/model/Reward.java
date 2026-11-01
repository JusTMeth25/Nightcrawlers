package com.nightcrawlers.gamedata.model;

/** Server-side reward formula constants (balance.json reward). */
public record Reward(double perSecond, double perKill, long maxPerMinute) {
}
