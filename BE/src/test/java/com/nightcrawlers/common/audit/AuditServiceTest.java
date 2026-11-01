package com.nightcrawlers.common.audit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.HexFormat;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.mock.web.MockHttpServletRequest;

class AuditServiceTest {

    @Test
    void recordsEventWithSaltedIpHashAndClockTime() throws Exception {
        AuditLogRepository repo = mock(AuditLogRepository.class);
        Instant now = Instant.parse("2026-10-31T10:00:00Z");
        AuditService service = new AuditService(repo, Clock.fixed(now, ZoneOffset.UTC), "pepper");
        MockHttpServletRequest req = new MockHttpServletRequest();
        req.setRemoteAddr("203.0.113.7");
        UUID userId = UUID.randomUUID();

        service.record(AuditEvent.LOGIN_SUCCESS, userId, req);

        ArgumentCaptor<AuditLog> captor = ArgumentCaptor.forClass(AuditLog.class);
        verify(repo).save(captor.capture());
        AuditLog saved = captor.getValue();
        String expected = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                .digest("pepper203.0.113.7".getBytes(StandardCharsets.UTF_8)));
        assertThat(saved.getIpHash()).isEqualTo(expected).doesNotContain("203.0.113.7");
        assertThat(saved.getUserId()).isEqualTo(userId);
        assertThat(saved.getEvent()).isEqualTo(AuditEvent.LOGIN_SUCCESS);
        assertThat(saved.getCreatedAt()).isEqualTo(now);
    }

    @Test
    void acceptsMissingUserAndRequest() {
        AuditLogRepository repo = mock(AuditLogRepository.class);
        AuditService service = new AuditService(repo, Clock.systemUTC(), "pepper");

        service.record(AuditEvent.ACCOUNT_DELETED, null, null);

        ArgumentCaptor<AuditLog> captor = ArgumentCaptor.forClass(AuditLog.class);
        verify(repo).save(captor.capture());
        assertThat(captor.getValue().getUserId()).isNull();
        assertThat(captor.getValue().getIpHash()).isNull();
    }
}
