package com.nightcrawlers.auth;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.argon2.Argon2PasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

@Configuration(proxyBeanMethods = false)
public class PasswordConfig {

    /**
     * Argon2id (BouncyCastle) with the OWASP minimum: 19 MiB memory, 2 iterations, parallelism 1,
     * 16-byte salt, 32-byte hash. Parameters are stored in each hash, so older hashes still verify.
     */
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new Argon2PasswordEncoder(16, 32, 1, 19456, 2);
    }
}
