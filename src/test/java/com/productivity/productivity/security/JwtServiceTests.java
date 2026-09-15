package com.productivity.productivity.security;

import io.jsonwebtoken.JwtException;
import org.junit.jupiter.api.Test;

import java.security.SecureRandom;
import java.util.HexFormat;

import static org.junit.jupiter.api.Assertions.*;

class JwtServiceTests {
    private String randomSecret() {
        byte[] bytes = new byte[32];
        new SecureRandom().nextBytes(bytes);
        return HexFormat.of().formatHex(bytes);
    }

    @Test
    void missingBlankAndShortSecretsFailBeforeServingRequests() {
        for (String secret : new String[]{null, "", " ".repeat(64), "too-short"}) {
            assertThrows(IllegalArgumentException.class, () -> new JwtService(secret, 60_000));
        }
    }

    @Test
    void invalidExpirationFailsBeforeServingRequests() {
        assertThrows(IllegalArgumentException.class, () -> new JwtService(randomSecret(), 0));
    }

    @Test
    void configuredKeySignsAndValidatesTheExpectedUser() {
        JwtService service = new JwtService(randomSecret(), 60_000);
        String token = service.generateToken("session@example.test");
        assertTrue(service.isTokenValid(token, "session@example.test"));
        assertFalse(service.isTokenValid(token, "another@example.test"));
    }

    @Test
    void rotatingTheKeyRejectsPreviouslyIssuedSessions() {
        JwtService oldService = new JwtService(randomSecret(), 60_000);
        JwtService rotatedService = new JwtService(randomSecret(), 60_000);
        String oldToken = oldService.generateToken("session@example.test");
        assertThrows(JwtException.class, () -> rotatedService.extractEmail(oldToken));
        String newToken = rotatedService.generateToken("session@example.test");
        assertTrue(rotatedService.isTokenValid(newToken, "session@example.test"));
    }
}
