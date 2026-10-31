package com.nightcrawlers.support;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;

import com.jayway.jsonpath.JsonPath;

/** Small HTTP helpers shared by the integration tests. */
public final class TestApi {

    public static final String PASSWORD = "Vy7#kq2!Lp9z";

    private final MockMvc mvc;
    private final CapturingMailService mail;

    public TestApi(MockMvc mvc, CapturingMailService mail) {
        this.mvc = mvc;
        this.mail = mail;
    }

    public record Account(String username, String email, String password) {
    }

    /** A login session: access token plus the two cookies set by the server. */
    public record Session(String accessToken, String refreshToken, String csrfToken) {
        public String bearer() {
            return "Bearer " + accessToken;
        }
    }

    public static String uniqueName() {
        return "u" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
    }

    public Account register() throws Exception {
        String name = uniqueName();
        Account account = new Account(name, name + "@mail.it", PASSWORD);
        mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"username":"%s","email":"%s","password":"%s"}"""
                        .formatted(account.username(), account.email(), account.password())))
                .andExpect(status().isAccepted());
        return account;
    }

    public Account registerVerified() throws Exception {
        Account account = register();
        String token = mail.lastTo(account.email()).token().orElseThrow();
        mvc.perform(post("/api/auth/verify-email").contentType(MediaType.APPLICATION_JSON)
                .content("{\"token\":\"" + token + "\"}")).andExpect(status().isNoContent());
        return account;
    }

    public ResultActions login(String login, String password) throws Exception {
        return mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"login\":\"%s\",\"password\":\"%s\"}".formatted(login, password)));
    }

    public Session loginSession(Account account) throws Exception {
        MvcResult result = login(account.username(), account.password()).andExpect(status().isOk()).andReturn();
        return session(result);
    }

    public static Session session(MvcResult result) throws Exception {
        MockHttpServletResponse response = result.getResponse();
        String access = JsonPath.read(response.getContentAsString(), "$.accessToken");
        return new Session(access, cookieValue(response, "refresh_token").orElseThrow(),
                cookieValue(response, "XSRF-TOKEN").orElseThrow());
    }

    public static List<String> setCookies(MockHttpServletResponse response) {
        return response.getHeaders("Set-Cookie");
    }

    public static Optional<String> setCookie(MockHttpServletResponse response, String name) {
        return setCookies(response).stream().filter(c -> c.startsWith(name + "=")).findFirst();
    }

    public static Optional<String> cookieValue(MockHttpServletResponse response, String name) {
        return setCookie(response, name).map(c -> c.substring(name.length() + 1, c.indexOf(';')));
    }

    public static List<String> attributes(String setCookie) {
        return Arrays.stream(setCookie.split(";")).map(String::trim).toList();
    }
}
