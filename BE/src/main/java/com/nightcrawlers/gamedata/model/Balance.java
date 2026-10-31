package com.nightcrawlers.gamedata.model;

/** The blocks of balance.json the server uses; the rest is ignored. */
public record Balance(Reward reward, AntiCheat antiCheat) {
}
