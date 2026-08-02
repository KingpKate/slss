package com.slss.api;

import com.slss.domain.SystemSetting;
import com.slss.repository.AiChannelRepository;
import com.slss.repository.CustomerTenantRepository;
import com.slss.repository.PermissionGroupRepository;
import com.slss.repository.SystemSettingRepository;
import com.slss.repository.UserRepository;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Read-only aggregate for the administration console.  It deliberately keeps
 * the response small and DTO-shaped so the shell does not need to fan out to
 * five unrelated endpoints just to render its first screen.
 */
@RestController
@RequestMapping("/api/v1/admin/overview")
public class AdminOverviewController {
  private final UserRepository users;
  private final PermissionGroupRepository groups;
  private final CustomerTenantRepository tenants;
  private final AiChannelRepository channels;
  private final SystemSettingRepository settings;

  public AdminOverviewController(UserRepository users, PermissionGroupRepository groups,
      CustomerTenantRepository tenants, AiChannelRepository channels,
      SystemSettingRepository settings) {
    this.users = users;
    this.groups = groups;
    this.tenants = tenants;
    this.channels = channels;
    this.settings = settings;
  }

  @GetMapping
  @PreAuthorize("hasAuthority('PERM_MANAGE_SYSTEM')")
  public Map<String, Object> overview() {
    var response = new LinkedHashMap<String, Object>();
    response.put("generatedAt", Instant.now());
    response.put("application", application());
    response.put("counts", counts());
    response.put("configuration", configuration());
    return response;
  }

  private Map<String, Object> application() {
    var data = new LinkedHashMap<String, Object>();
    data.put("version", value("app_version", "2.1.0"));
    data.put("appName", value("app_name", "SLSS - 服务器全生命周期系统"));
    data.put("theme", value("theme", "green"));
    data.put("maintenanceMode", Boolean.parseBoolean(value("maintenance_mode", "false")));
    return data;
  }

  private Map<String, Object> counts() {
    var data = new LinkedHashMap<String, Object>();
    data.put("users", users.count());
    data.put("permissionGroups", groups.findAllByDeletedAtIsNullOrderByNameAsc().size());
    data.put("tenants", tenants.count());
    data.put("aiChannels", channels.count());
    data.put("enabledAiChannels", channels.findByEnabledTrueOrderByPriorityAscIdAsc().size());
    return data;
  }

  private Map<String, Object> configuration() {
    var data = new LinkedHashMap<String, Object>();
    data.put("logRetentionDays", value("log_retention_days", "90"));
    data.put("brandingConfigured", settings.findById("company_logo")
        .map(SystemSetting::getSettingValue).filter(v -> v != null && !v.isBlank()).isPresent());
    return data;
  }

  private String value(String key, String fallback) {
    return settings.findById(key).map(SystemSetting::getSettingValue)
        .filter(v -> v != null && !v.isBlank()).orElse(fallback);
  }
}
