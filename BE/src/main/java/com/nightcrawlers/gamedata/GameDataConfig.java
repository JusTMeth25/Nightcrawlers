package com.nightcrawlers.gamedata;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration(proxyBeanMethods = false)
public class GameDataConfig {

    /** Loaded once at startup; the application does not start with missing or invalid data. */
    @Bean
    GameData gameData() {
        return GameData.load("gamedata/");
    }
}
