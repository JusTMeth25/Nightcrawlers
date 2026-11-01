package com.nightcrawlers;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Arrays;

import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationInfo;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import com.nightcrawlers.support.IntegrationTest;

@IntegrationTest
class ApplicationIT {

    @Autowired
    Flyway flyway;

    @Test
    void contextStartsAndAppliesAllMigrations() {
        assertThat(Arrays.stream(flyway.info().applied()).map(MigrationInfo::getVersion).map(Object::toString))
                .contains("1", "2", "3");
    }
}
