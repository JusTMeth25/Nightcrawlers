package com.nightcrawlers.user;

import java.time.Instant;
import java.util.UUID;

public record UserDto(UUID id, String username, String email, boolean emailVerified, Instant createdAt,
        String locale) {

    public static UserDto from(User user) {
        return new UserDto(user.getId(), user.getUsername(), user.getEmail(), user.isEmailVerified(),
                user.getCreatedAt(), user.getLocale());
    }
}
