package com.nightcrawlers.auth.dto;

import com.nightcrawlers.user.UserDto;

public record AuthResponse(String accessToken, long expiresInSec, UserDto user) {

    @Override
    public String toString() {
        return "AuthResponse[user=" + user + "]";
    }
}
