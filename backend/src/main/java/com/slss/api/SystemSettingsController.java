package com.slss.api;

import com.slss.domain.SystemSetting;
import com.slss.repository.SystemSettingRepository;
import com.slss.service.AuditService;
import jakarta.transaction.Transactional;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.time.Instant;
import java.util.Map;
import java.util.LinkedHashMap;
import java.util.Set;
import java.util.Base64;
import java.io.ByteArrayInputStream;
import javax.imageio.ImageIO;

@RestController
@RequestMapping("/api/v1/settings")
public class SystemSettingsController {
  private static final String COMPANY_LOGO = "company_logo";
  private static final String AI_PROVIDER = "ai_provider";
  private static final String AI_MODEL = "ai_model";
  private static final String AI_BASE_URL = "ai_base_url";
  private static final String AI_API_KEY = "ai_api_key";
  private static final Set<String> PUBLIC_KEYS = Set.of("app_name", "theme", "maintenance_mode", "log_retention_days");
  private final SystemSettingRepository settings;
  private final AuditService audit;
  public SystemSettingsController(SystemSettingRepository settings, AuditService audit) { this.settings = settings; this.audit = audit; }

  public record SettingsUpdateRequest(@NotBlank @Size(max=120) String appName,
      @NotBlank @Pattern(regexp="blue|purple|green|orange|slate") String theme,
      Boolean maintenanceMode, @NotNull @Min(1) @Max(3650) Integer logRetentionDays) {}
  public record BrandingResponse(String appName, String theme, String logo) {}

  @GetMapping("/company-logo")
  public Map<String, Object> companyLogo() {
    return Map.of("value", settings.findById(COMPANY_LOGO).map(SystemSetting::getSettingValue).orElse(""));
  }

  @GetMapping
  public Map<String, Object> getSettings() {
    var result = new LinkedHashMap<String, Object>();
    result.put("appName", value("app_name", "SLSS - 服务器全生命周期系统"));
    result.put("theme", value("theme", "green"));
    result.put("maintenanceMode", Boolean.parseBoolean(value("maintenance_mode", "false")));
    result.put("logRetentionDays", retentionDays());
    return result;
  }

  /** Public, non-secret branding payload used by the login shell and app chrome. */
  @GetMapping("/branding")
  public BrandingResponse branding() {
    return new BrandingResponse(value("app_name", "SLSS - 服务器全生命周期系统"), value("theme", "green"), value(COMPANY_LOGO, ""));
  }

  @PutMapping
  @PreAuthorize("hasAuthority('PERM_MANAGE_SYSTEM')")
  @Transactional
  public Map<String, Object> updateSettings(@Valid @RequestBody SettingsUpdateRequest request, java.security.Principal actor, jakarta.servlet.http.HttpServletRequest http) {
    save("app_name", request.appName().trim());
    save("theme", request.theme());
    save("maintenance_mode", String.valueOf(Boolean.TRUE.equals(request.maintenanceMode())));
    save("log_retention_days", String.valueOf(request.logRetentionDays()));
    audit.record(actor == null ? "system" : actor.getName(), "SYSTEM_SETTINGS_UPDATE", "SYSTEM_SETTINGS", "global", request.toString(), http.getRemoteAddr(), true);
    return getSettings();
  }

  @GetMapping("/ai")
  @PreAuthorize("hasAuthority('PERM_MANAGE_SYSTEM')")
  public Map<String, Object> aiSettings() {
    var key = value(AI_API_KEY, "");
    return Map.of("provider", value(AI_PROVIDER, "google"), "model", value(AI_MODEL, "gemini-2.5-flash"),
        "baseUrl", value(AI_BASE_URL, ""), "hasApiKey", !key.isBlank(),
        "apiKeyMasked", key.isBlank() ? "" : "••••••••" + key.substring(Math.max(0, key.length() - 4)));
  }

  @PutMapping("/ai")
  @PreAuthorize("hasAuthority('PERM_MANAGE_SYSTEM')")
  @Transactional
  public Map<String, Object> updateAiSettings(@RequestBody Map<String, String> body, java.security.Principal actor, jakarta.servlet.http.HttpServletRequest http) {
    if (body == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "AI 配置不能为空");
    var provider = text(body.get("provider"), 1, 30, "AI 渠道");
    if (!Set.of("google", "openai", "deepseek", "zhipu", "modelscope", "custom").contains(provider)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "不支持的 AI 渠道");
    saveRaw(AI_PROVIDER, provider);
    saveRaw(AI_MODEL, text(body.get("model"), 1, 120, "模型名称"));
    var baseUrl = body.getOrDefault("baseUrl", "").trim();
    if (baseUrl.length() > 500) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "接口地址过长");
    saveRaw(AI_BASE_URL, baseUrl);
    // Empty key means keep the existing secret; the UI never receives the raw value.
    var apiKey = body.get("apiKey");
    if (apiKey != null && !apiKey.isBlank() && !apiKey.startsWith("••••")) {
      if (apiKey.length() > 500) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "AI 密钥过长");
      saveRaw(AI_API_KEY, apiKey.trim());
    }
    audit.record(actor == null ? "system" : actor.getName(), "SYSTEM_AI_SETTINGS_UPDATE", "SYSTEM_SETTINGS", "ai", "AI 配置已更新", http.getRemoteAddr(), true);
    return aiSettings();
  }

  private String value(String key, String fallback) { return settings.findById(key).map(SystemSetting::getSettingValue).filter(v -> v != null && !v.isBlank()).orElse(fallback); }
  private int retentionDays() {
    try {
      int days = Integer.parseInt(value("log_retention_days", "90"));
      return days >= 1 && days <= 3650 ? days : 90;
    } catch (RuntimeException ignored) { return 90; }
  }
  private void save(String key, String value) {
    if (!PUBLIC_KEYS.contains(key)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "不允许修改的系统参数");
    saveRaw(key, value);
  }
  private void saveRaw(String key, String value) {
    var setting = settings.findById(key).orElseGet(() -> { var item = new SystemSetting(); item.setSettingKey(key); return item; });
    setting.setSettingValue(value); setting.setUpdatedAt(Instant.now()); settings.save(setting);
  }
  private static String text(Object value, int min, int max, String label) {
    String text = value == null ? "" : String.valueOf(value).trim();
    if (text.length() < min || text.length() > max) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, label + "长度不合法");
    return text;
  }

  @PutMapping("/company-logo")
  @PreAuthorize("hasAuthority('PERM_MANAGE_SYSTEM')")
  @Transactional
  public Map<String, Object> updateCompanyLogo(@RequestBody Map<String, String> body, java.security.Principal actor, jakarta.servlet.http.HttpServletRequest http) {
    var value = body == null ? null : body.get("value");
    if (value == null || value.isBlank()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "LOGO 内容不能为空");
    var match = java.util.regex.Pattern.compile("^data:image/(png|jpeg|jpg|gif|webp);base64,([A-Za-z0-9+/=]+)$").matcher(value);
    if (!match.matches()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "仅支持 PNG/JPEG/GIF/WEBP 图片 LOGO，不支持 SVG");
    final byte[] bytes;
    try { bytes = Base64.getDecoder().decode(match.group(2)); }
    catch (IllegalArgumentException ex) { throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "LOGO 编码无效"); }
    if (bytes.length == 0 || bytes.length > 2_000_000) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "LOGO 文件大小须在 1B-2MB 之间");
    try {
      var image = ImageIO.read(new ByteArrayInputStream(bytes));
      if (image == null || image.getWidth() > 4096 || image.getHeight() > 4096) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "LOGO 图片格式或尺寸无效");
    } catch (java.io.IOException ex) { throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "LOGO 图片无法解析"); }
    var setting = settings.findById(COMPANY_LOGO).orElseGet(() -> { var item = new SystemSetting(); item.setSettingKey(COMPANY_LOGO); return item; });
    setting.setSettingValue(value); setting.setUpdatedAt(Instant.now()); settings.save(setting);
    audit.record(actor == null ? "system" : actor.getName(), "SYSTEM_BRANDING_LOGO_UPDATE", "SYSTEM_SETTINGS", COMPANY_LOGO, "logo updated", http.getRemoteAddr(), true);
    return Map.of("value", value, "updatedAt", setting.getUpdatedAt());
  }
}
