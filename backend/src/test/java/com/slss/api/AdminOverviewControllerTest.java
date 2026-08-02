package com.slss.api;

import com.slss.domain.SystemSetting;
import com.slss.repository.AiChannelRepository;
import com.slss.repository.CustomerTenantRepository;
import com.slss.repository.PermissionGroupRepository;
import com.slss.repository.SystemSettingRepository;
import com.slss.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * Contract-level tests for the administration overview payload.  Keeping this
 * test at the controller boundary protects the frontend contract while the
 * individual admin domains are being split into separate modules.
 */
class AdminOverviewControllerTest {
  private UserRepository users;
  private PermissionGroupRepository groups;
  private CustomerTenantRepository tenants;
  private AiChannelRepository channels;
  private SystemSettingRepository settings;
  private AdminOverviewController controller;

  @BeforeEach
  void setUp() {
    users = mock(UserRepository.class);
    groups = mock(PermissionGroupRepository.class);
    tenants = mock(CustomerTenantRepository.class);
    channels = mock(AiChannelRepository.class);
    settings = mock(SystemSettingRepository.class);
    when(users.count()).thenReturn(12L);
    when(groups.countByDeletedAtIsNull()).thenReturn(3L);
    when(tenants.count()).thenReturn(2L);
    when(channels.count()).thenReturn(4L);
    when(channels.countByEnabledTrue()).thenReturn(2L);
    when(settings.findById(anyString())).thenReturn(Optional.empty());
    controller = new AdminOverviewController(users, groups, tenants, channels, settings);
  }

  @Test
  void overviewContainsStableAggregateContract() {
    var result = controller.overview();
    assertNotNull(result.get("generatedAt"));
    assertInstanceOf(java.util.Map.class, result.get("application"));
    assertInstanceOf(java.util.Map.class, result.get("counts"));
    var counts = (java.util.Map<?, ?>) result.get("counts");
    assertEquals(12L, counts.get("users"));
    assertEquals(3L, counts.get("permissionGroups"));
    assertEquals(2L, counts.get("tenants"));
    assertEquals(4L, counts.get("aiChannels"));
    assertEquals(2L, counts.get("enabledAiChannels"));
  }

  @Test
  void overviewUsesPersistedBrandingAndApplicationSettings() {
    when(settings.findById("app_name")).thenReturn(Optional.of(setting("app_name", "MES Console")));
    when(settings.findById("theme")).thenReturn(Optional.of(setting("theme", "slate")));
    when(settings.findById("maintenance_mode")).thenReturn(Optional.of(setting("maintenance_mode", "true")));
    when(settings.findById("log_retention_days")).thenReturn(Optional.of(setting("log_retention_days", "180")));
    when(settings.findById("company_logo")).thenReturn(Optional.of(setting("company_logo", "data:image/png;base64,abc")));

    var result = controller.overview();
    var app = (java.util.Map<?, ?>) result.get("application");
    var config = (java.util.Map<?, ?>) result.get("configuration");
    assertEquals("MES Console", app.get("appName"));
    assertEquals("slate", app.get("theme"));
    assertEquals(true, app.get("maintenanceMode"));
    assertEquals("180", config.get("logRetentionDays"));
    assertEquals(true, config.get("brandingConfigured"));
  }

  private static SystemSetting setting(String key, String value) {
    var setting = new SystemSetting();
    setting.setSettingKey(key);
    setting.setSettingValue(value);
    return setting;
  }
}
