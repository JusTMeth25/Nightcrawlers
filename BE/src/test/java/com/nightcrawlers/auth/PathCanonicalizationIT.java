package com.nightcrawlers.auth;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.http.HttpResponse;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.test.web.servlet.MockMvc;

import com.nightcrawlers.support.CapturingMailService;
import com.nightcrawlers.support.IntegrationTest;
import com.nightcrawlers.support.RawHttp;
import com.nightcrawlers.support.TestApi;
import com.nightcrawlers.support.TestApi.Account;

/** Non-canonical spellings of auth paths must not slip past CSRF, rate limits or the token resolver. */
@IntegrationTest
class PathCanonicalizationIT {

    @LocalServerPort
    int port;
    @Autowired
    MockMvc mvc;
    @Autowired
    CapturingMailService mail;

    RawHttp http;
    Account account;

    @BeforeEach
    void setUp() throws Exception {
        http = new RawHttp(port);
        account = new TestApi(mvc, mail).register();
    }

    @Test
    void canonicalLoginWorksOverRealHttp() {
        HttpResponse<String> response = http.post("/api/auth/login",
                RawHttp.loginBody(account.username(), account.password()));
        assertThat(response.statusCode()).isEqualTo(200);
    }

    @Test
    void percentEncodedRefreshNeverReachesTheControllerWithoutCsrf() {
        HttpResponse<String> response = http.post("/api/auth/%72efresh", null, "Cookie", "refresh_token=abc");
        assertThat(response.statusCode()).isIn(400, 403);
        assertThat(response.headers().firstValue("Content-Type")).hasValueSatisfying(
                ct -> assertThat(ct).startsWith("application/problem+json"));
    }

    @ParameterizedTest
    @ValueSource(strings = { "/api/auth/logi%6E", "/api/auth/%6cogin", "/api/auth//login", "/api/auth/./login",
            "/api/auth/login;jsessionid=x", "/api/auth/login/", "/api//auth/login" })
    void nonCanonicalLoginPathsAreRejected(String path) {
        HttpResponse<String> response = http.post(path, RawHttp.loginBody(account.username(), account.password()));
        assertThat(response.statusCode()).as(path).isEqualTo(400);
    }
}
