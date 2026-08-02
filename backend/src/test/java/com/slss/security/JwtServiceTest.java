package com.slss.security;
import org.junit.jupiter.api.Test; import java.time.Duration; import java.util.List; import static org.junit.jupiter.api.Assertions.*;
class JwtServiceTest { @Test void issueAndParseToken(){var s=new JwtService("test-secret-that-is-at-least-32-bytes-long",Duration.ofMinutes(5));var token=s.issue("admin",List.of("PERM_VIEW_ORDERS"));var claims=s.parse(token).getPayload();assertEquals("admin",claims.getSubject());assertNotNull(claims.getExpiration());} }
