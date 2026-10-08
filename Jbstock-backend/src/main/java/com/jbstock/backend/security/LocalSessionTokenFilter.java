package com.jbstock.backend.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Collections;

/** Transport gate only: this token does not identify a business user. */
public final class LocalSessionTokenFilter extends OncePerRequestFilter {
    public static final String HEADER = "X-JBStock-Local-Token";
    private final byte[] expectedToken;

    public LocalSessionTokenFilter(String token) {
        if (token == null || !token.matches("[a-f0-9]{64}")) {
            throw new IllegalStateException(
                    "JBSTOCK_LOCAL_SESSION_TOKEN must contain 64 lowercase hexadecimal characters generated from 32 random bytes.");
        }
        expectedToken = token.getBytes(StandardCharsets.US_ASCII);
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getServletPath();
        return "GET".equals(request.getMethod())
                && ("/health".equals(path) || "/actuator/health".equals(path));
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        var headers = Collections.list(request.getHeaders(HEADER));
        if (headers.size() != 1 || headers.getFirst().length() != 64
                || !MessageDigest.isEqual(expectedToken, headers.getFirst().getBytes(StandardCharsets.US_ASCII))) {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setContentType("application/json");
            response.setCharacterEncoding(StandardCharsets.UTF_8.name());
            response.setHeader("Cache-Control", "no-store");
            response.getWriter().write("{\"code\":\"LOCAL_SESSION_UNAUTHORIZED\",\"message\":\"Session locale invalide.\",\"fields\":[]}");
            return;
        }
        chain.doFilter(request, response);
    }
}
