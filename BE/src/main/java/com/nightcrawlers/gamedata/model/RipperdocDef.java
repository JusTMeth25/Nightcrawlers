package com.nightcrawlers.gamedata.model;

/** Permanent upgrade; per-rank effects are applied by the client. */
public record RipperdocDef(String id, String name, int maxRank, long baseCost, double costGrowth) {
}
