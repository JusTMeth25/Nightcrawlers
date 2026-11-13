package com.nightcrawlers.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

import java.nio.charset.StandardCharsets;
import java.time.Duration;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.oauth2.jwt.JwtDecoder;

import com.nightcrawlers.auth.RateLimitProperties.Limit;
import com.nightcrawlers.common.I18nConfig;
import com.nightcrawlers.common.Messages;
import com.nightcrawlers.common.ProblemResponses;

import tools.jackson.databind.json.JsonMapper;

class RateLimitFilterTest {

    static final Limit MANY = new Limit(1000, Duration.ofMinutes(1));
    static final RateLimitProperties LIMITS = new RateLimitProperties(MANY, MANY, MANY, MANY, MANY, MANY, MANY);

    final JsonMapper json = JsonMapper.builder().build();

    RateLimitFilter filter(long maxBuckets) {
        return new RateLimitFilter(LIMITS, new ProblemResponses(json, new Messages(new I18nConfig().messageSource())), json, mock(JwtDecoder.class), maxBuckets);
    }

    static MockHttpServletRequest login(String ip, String login) {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/auth/login");
        request.setRemoteAddr(ip);
        request.setContentType("application/json");
        request.setContent(("{\"login\":\"" + login + "\",\"password\":\"x\"}").getBytes(StandardCharsets.UTF_8));
        return request;
    }

    @Test
    void normalLoginUsesAnIpAndAnAccountBucket() throws Exception {
        RateLimitFilter filter = filter(10_000);
        filter.doFilter(login("192.0.2.1", "mario"), new MockHttpServletResponse(), new MockFilterChain());
        assertThat(filter.bucketCount()).isEqualTo(2);
    }

    @Test
    void oversizedLoginValuesCreateNoAccountBucket() throws Exception {
        RateLimitFilter filter = filter(10_000);
        for (int i = 0; i < 20; i++) {
            filter.doFilter(login("192.0.2.1", "a".repeat(255) + i), new MockHttpServletResponse(),
                    new MockFilterChain());
        }
        assertThat(filter.bucketCount()).isEqualTo(1);
    }

    @Test
    void bucketMapIsBounded() throws Exception {
        RateLimitFilter filter = filter(50);
        for (int i = 0; i < 500; i++) {
            filter.doFilter(login("10.0." + (i / 250) + "." + (i % 250), "user" + i), new MockHttpServletResponse(),
                    new MockFilterChain());
        }
        assertThat(filter.bucketCount()).isLessThanOrEqualTo(50);
    }
}
