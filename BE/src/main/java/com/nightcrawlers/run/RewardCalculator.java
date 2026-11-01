package com.nightcrawlers.run;

import java.math.BigDecimal;
import java.math.RoundingMode;

import org.springframework.stereotype.Component;

import com.nightcrawlers.gamedata.GameData;
import com.nightcrawlers.gamedata.model.Reward;

/**
 * €$ awarded at the end of a run, computed by the server only:
 * {@code floor(min(d*perSecond + k*perKill, maxPerMinute*ceil(d/60)) * (1 + 0.10*greedRank))}.
 * Decimal arithmetic, so a product such as {@code 330 * 1.3} never floors to 428.
 */
@Component
public class RewardCalculator {

    static final BigDecimal GREED_PER_RANK = new BigDecimal("0.10");

    private final BigDecimal perSecond;
    private final BigDecimal perKill;
    private final BigDecimal maxPerMinute;

    public RewardCalculator(GameData gameData) {
        Reward reward = gameData.reward();
        this.perSecond = BigDecimal.valueOf(reward.perSecond());
        this.perKill = BigDecimal.valueOf(reward.perKill());
        this.maxPerMinute = BigDecimal.valueOf(reward.maxPerMinute());
    }

    public long compute(long durationSec, long kills, int greedRank) {
        long seconds = Math.max(0, durationSec);
        BigDecimal earned = perSecond.multiply(BigDecimal.valueOf(seconds))
                .add(perKill.multiply(BigDecimal.valueOf(Math.max(0, kills))));
        long startedMinutes = (seconds + 59) / 60;
        BigDecimal cap = maxPerMinute.multiply(BigDecimal.valueOf(startedMinutes));
        BigDecimal bonus = BigDecimal.ONE.add(GREED_PER_RANK.multiply(BigDecimal.valueOf(Math.max(0, greedRank))));
        return earned.min(cap).multiply(bonus).setScale(0, RoundingMode.FLOOR).longValueExact();
    }
}
