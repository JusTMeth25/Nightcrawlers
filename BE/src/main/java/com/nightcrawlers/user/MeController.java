package com.nightcrawlers.user;

import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.nightcrawlers.auth.AuthCookies;
import com.nightcrawlers.auth.CurrentUser;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/me")
public class MeController {

    static final String EXPORT_FILENAME = "nightcrawlers-export.json";

    private final AccountService accounts;
    private final AuthCookies cookies;

    public MeController(AccountService accounts, AuthCookies cookies) {
        this.accounts = accounts;
        this.cookies = cookies;
    }

    @GetMapping
    public UserDto me(Authentication authentication) {
        return accounts.profile(CurrentUser.id(authentication));
    }

    @GetMapping("/export")
    public ResponseEntity<AccountExport> export(Authentication authentication) {
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename(EXPORT_FILENAME).build().toString())
                .body(accounts.export(CurrentUser.id(authentication)));
    }

    @DeleteMapping
    public ResponseEntity<Void> delete(@Valid @RequestBody DeleteAccountRequest request,
            Authentication authentication, HttpServletRequest http, HttpServletResponse response) {
        accounts.delete(CurrentUser.id(authentication), request.password(), http);
        cookies.clear(response);
        return ResponseEntity.noContent().build();
    }
}
