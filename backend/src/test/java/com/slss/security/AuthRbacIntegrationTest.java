package com.slss.security;

import com.slss.api.AssetController;
import com.slss.api.AuthController;
import com.slss.config.SecurityConfig;
import com.slss.domain.Permission;
import com.slss.domain.Role;
import com.slss.domain.User;
import com.slss.repository.AssetRepository;
import com.slss.repository.AssetComponentRepository;
import com.slss.repository.LifecycleEventRepository;
import com.slss.repository.ScanTableRepository;
import com.slss.repository.UserRepository;
import com.slss.repository.RefreshTokenRepository;
import com.slss.service.AuditService;
import com.slss.service.PermissionCacheService;
import com.slss.service.LoginAttemptService;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.anyString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(
    controllers = {AuthController.class, AssetController.class},
    properties = {
      "slss.security.jwt-secret=01234567890123456789012345678901",
      "slss.security.refresh-secret=98765432109876543210987654321098",
      "slss.security.jwt-ttl=PT5M",
      "spring.main.web-application-type=servlet"
    })
@Import({SecurityConfig.class, JwtService.class, JwtAuthenticationFilter.class})
class AuthRbacIntegrationTest {
  @Autowired MockMvc mvc;
  @Autowired PasswordEncoder encoder;
  @Autowired JwtService jwt;
  @MockBean UserRepository users;
  @MockBean RefreshTokenRepository refreshTokens;
  @MockBean AuditService audit;
  @MockBean AssetRepository assets;
  @MockBean AssetComponentRepository assetComponents;
  @MockBean LifecycleEventRepository lifecycleEvents;
  @MockBean ScanTableRepository scanTables;
  @MockBean PermissionCacheService permissionCache;
  @MockBean LoginAttemptService loginAttempts;

  @BeforeEach
  void stubPermissionCache() {
    when(permissionCache.evaluate(anyString())).thenAnswer(inv -> {
      String username = inv.getArgument(0);
      var permissions = (username.equals("operator") || username.equals("production-user"))
          ? java.util.Set.of("VIEW_PRODUCTION") : java.util.Set.<String>of();
      return new PermissionCacheService.EffectivePermissions(permissions, java.util.Set.of(), java.util.Map.of(), java.util.Map.of(), 1L);
    });
  }

  @Test
  void loginReturnsUsableJwtWithDatabasePermissions() throws Exception {
    var permission = new Permission("VIEW_PRODUCTION");
    var role = new Role("PRODUCTION");
    role.getPermissions().add(permission);
    var user = new User("operator", encoder.encode("correct-password"));
    user.getRoles().add(role);
    when(users.findByUsernameAndStatus("operator", "ACTIVE")).thenReturn(Optional.of(user));

    mvc.perform(post("/api/v1/auth/login")
            .contentType("application/json")
            .content("""
                {"username":"operator","password":"correct-password"}
                """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.tokenType").value("Bearer"))
        .andExpect(jsonPath("$.username").value("operator"))
        .andExpect(jsonPath("$.token").isNotEmpty())
        .andExpect(jsonPath("$.authorities[0]").value("PERM_VIEW_PRODUCTION"));
  }

  @Test
  void loginRejectsInvalidPassword() throws Exception {
    var user = new User("operator", encoder.encode("correct-password"));
    when(users.findByUsernameAndStatus("operator", "ACTIVE")).thenReturn(Optional.of(user));

    mvc.perform(post("/api/v1/auth/login")
            .contentType("application/json")
            .content("""
                {"username":"operator","password":"wrong-password"}
                """))
        .andExpect(status().isUnauthorized());
  }

  @Test
  void assetApiRequiresAuthentication() throws Exception {
    mvc.perform(get("/api/v1/assets")).andExpect(status().isForbidden());
    verifyNoInteractions(assets);
  }

  @Test
  void assetApiRejectsAuthenticatedUserWithoutProductionPermission() throws Exception {
    var token = jwt.issue("service-user", List.of("PERM_VIEW_ORDERS"));
    mvc.perform(get("/api/v1/assets").header("Authorization", "Bearer " + token))
        .andExpect(status().isForbidden());
    verifyNoInteractions(assets);
  }

  @Test
  void assetApiAllowsProductionViewer() throws Exception {
    var productionUser = new User("production-user", encoder.encode("unused"));
    when(users.findByUsernameAndStatus("production-user", "ACTIVE")).thenReturn(Optional.of(productionUser));
    when(assets.findAll()).thenReturn(List.of());
    var token = jwt.issue("production-user", List.of("PERM_VIEW_PRODUCTION"));
    mvc.perform(get("/api/v1/assets").header("Authorization", "Bearer " + token))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$").isArray());
  }
}
