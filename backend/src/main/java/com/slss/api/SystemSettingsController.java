package com.slss.api;

import com.slss.domain.SystemSetting;
import com.slss.repository.SystemSettingRepository;
import jakarta.transaction.Transactional;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.time.Instant;
import java.util.Map;
import java.util.LinkedHashMap;
import java.util.Set;

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
  public SystemSettingsController(SystemSettingRepository settings) { this.settings = settings; }

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
    result.put("logRetentionDays", Integer.parseInt(value("log_retention_days", "90")));
    return result;
  }

  @PutMapping
  @PreAuthorize("hasAuthority('PERM_MANAGE_SYSTEM')")
  @Transactional
  public Map<String, Object> updateSettings(@RequestBody Map<String, Object> body) {
    if (body == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "设置内容不能为空");
    save("app_name", text(body.get("appName"), 1, 120, "系统名称"));
    var theme = text(body.get("theme"), 1, 20, "主题");
    if (!Set.of("blue", "purple", "green", "orange", "slate").contains(theme)) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "不支持的系统主题");
    }
    save("theme", theme);
    save("maintenance_mode", String.valueOf(Boolean.TRUE.equals(body.get("maintenanceMode"))));
    Object retention = body.get("logRetentionDays");
    int days;
    try { days = Integer.parseInt(String.valueOf(retention)); } catch (Exception ex) { throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "日志保留天数必须为数字"); }
    if (days < 1 || days > 3650) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "日志保留天数必须在 1-3650 之间");
    save("log_retention_days", String.valueOf(days));
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
  public Map<String, Object> updateAiSettings(@RequestBody Map<String, String> body) {
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
    if (apiKey != null && !apiKey.isBlank() && !apiKey.startsWith("••••")) saveRaw(AI_API_KEY, apiKey.trim());
    return aiSettings();
  }

  private String value(String key, String fallback) { return settings.findById(key).map(SystemSetting::getSettingValue).filter(v -> v != null && !v.isBlank()).orElse(fallback); }
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
  public Map<String, Object> updateCompanyLogo(@RequestBody Map<String, String> body) {
    var value = body == null ? null : body.get("value");
    if (value == null || value.isBlank()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "LOGO 内容不能为空");
    if (!value.startsWith("data:image/")) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "仅支持图片 LOGO");
    if (value.length() > 3_000_000) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "LOGO 文件过大");
    var setting = settings.findById(COMPANY_LOGO).orElseGet(() -> { var item = new SystemSetting(); item.setSettingKey(COMPANY_LOGO); return item; });
    setting.setSettingValue(value); setting.setUpdatedAt(Instant.now()); settings.save(setting);
    return Map.of("value", value, "updatedAt", setting.getUpdatedAt());
  }
}
