package com.nightcrawlers.auth;

import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;

import com.nightcrawlers.common.ApiException;

public final class CurrentUser {

    private CurrentUser() {
    }

    /** The user id from the access token subject. */
    public static UUID id(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "error.notAuthenticated");
        }
        try {
            return UUID.fromString(authentication.getName());
        } catch (IllegalArgumentException e) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "error.notAuthenticated");
        }
    }
}
