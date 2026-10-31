package com.nightcrawlers.save;

import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.nightcrawlers.auth.CurrentUser;

@RestController
@RequestMapping("/api/save")
public class SaveController {

    private final SaveService saves;

    public SaveController(SaveService saves) {
        this.saves = saves;
    }

    @GetMapping
    public SaveDto save(Authentication authentication) {
        return saves.load(CurrentUser.id(authentication));
    }
}
