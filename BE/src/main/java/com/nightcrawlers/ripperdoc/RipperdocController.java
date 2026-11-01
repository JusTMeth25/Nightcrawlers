package com.nightcrawlers.ripperdoc;

import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.nightcrawlers.auth.CurrentUser;
import com.nightcrawlers.save.SaveDto;

import jakarta.servlet.http.HttpServletRequest;

@RestController
@RequestMapping("/api/ripperdoc")
public class RipperdocController {

    private final RipperdocService ripperdoc;

    public RipperdocController(RipperdocService ripperdoc) {
        this.ripperdoc = ripperdoc;
    }

    @PostMapping("/{upgradeId}/buy")
    public SaveDto buy(@PathVariable String upgradeId, Authentication authentication, HttpServletRequest http) {
        return ripperdoc.buy(CurrentUser.id(authentication), upgradeId, http);
    }
}
