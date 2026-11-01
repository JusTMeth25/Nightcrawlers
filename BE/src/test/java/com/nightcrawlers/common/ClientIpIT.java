package com.nightcrawlers.common;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Comparator;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.test.web.servlet.MockMvc;

import com.nightcrawlers.common.audit.AuditEvent;
import com.nightcrawlers.common.audit.AuditLog;
import com.nightcrawlers.common.audit.AuditLogRepository;
import com.nightcrawlers.support.CapturingMailService;
import com.nightcrawlers.support.IntegrationTest;
import com.nightcrawlers.support.RawHttp;
import com.nightcrawlers.support.TestApi;
import com.nightcrawlers.support.TestApi.Account;
import com.nightcrawlers.user.UserRepository;

/** Real HTTP: loopback is a trusted proxy here (default internal proxies). */
@IntegrationTest
class ClientIpIT {

    static final String SALT = "test-only-salt";

    @LocalServerPort
    int port;
    @Autowired
    MockMvc mvc;
    @Autowired
    CapturingMailService mail;
    @Autowired
    AuditLogRepository audit;
    @Autowired
    UserRepository users;

    RawHttp http;
    Account account;

    @BeforeEach
    void setUp() throws Exception {
        http = new RawHttp(port);
        account = new TestApi(mvc, mail).register();
    }

    String lastLoginIpHash() {
        var id = users.findByEmail(account.email()).orElseThrow().getId();
        return audit.findByUserId(id).stream().filter(a -> a.getEvent() == AuditEvent.LOGIN_SUCCESS)
                .max(Comparator.comparing(AuditLog::getId)).orElseThrow().getIpHash();
    }

    @Test
    void xForwardedForFromATrustedProxyIsTheClientIp() {
        assertThat(http.post("/api/auth/login", RawHttp.loginBody(account.username(), account.password()),
                "X-Forwarded-For", "203.0.113.9").statusCode()).isEqualTo(200);
        assertThat(lastLoginIpHash()).isEqualTo(SecureTokens.sha256Hex(SALT + "203.0.113.9"));
    }

    @Test
    void rfc7239ForwardedHeaderIsIgnored() {
        assertThat(http.post("/api/auth/login", RawHttp.loginBody(account.username(), account.password()),
                "Forwarded", "for=198.51.100.7").statusCode()).isEqualTo(200);
        assertThat(lastLoginIpHash()).isEqualTo(SecureTokens.sha256Hex(SALT + "127.0.0.1"));
    }
}
