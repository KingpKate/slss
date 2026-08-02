package com.slss.api;

import com.slss.domain.SystemSetting;
import com.slss.repository.SystemSettingRepository;
import com.slss.repository.BrandingHistoryRepository;
import com.slss.domain.BrandingHistory;
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
import java.util.List;
import java.util.ArrayList;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Base64;
import java.io.ByteArrayInputStream;
import javax.imageio.ImageIO;

@RestController
@RequestMapping("/api/v1/settings")
public class SystemSettingsController {
  private static final String COMPANY_LOGO = "company_logo";
  private static final Set<String> PUBLIC_KEYS = Set.of("app_name", "theme", "maintenance_mode", "log_retention_days", "login_subtitle", "login_background_mode", "login_background_color", "login_background_images", "login_background_interval", "login_background_overlay", "login_background_position", "login_captcha_enabled", "login_captcha_trigger", "login_captcha_expire", "login_captcha_max_attempts");
  private final SystemSettingRepository settings;
  private final AuditService audit;
  private final BrandingHistoryRepository brandingHistory;
  public SystemSettingsController(SystemSettingRepository settings, AuditService audit, BrandingHistoryRepository brandingHistory) { this.settings = settings; this.audit = audit; this.brandingHistory = brandingHistory; }

  public record SettingsUpdateRequest(@NotBlank @Size(max=120) String appName,
      @NotBlank @Pattern(regexp="blue|purple|green|orange|slate") String theme,
      Boolean maintenanceMode, @NotNull @Min(1) @Max(3650) Integer logRetentionDays, Long version,
      @Size(max=240) String loginSubtitle, String loginBackgroundMode, @Size(max=16) String loginBackgroundColor,
      @Size(max=8000000) String loginBackgroundImages, Integer loginBackgroundIntervalSeconds,
      Integer loginBackgroundOverlay, String loginBackgroundPosition, Boolean loginCaptchaEnabled,
      Integer loginCaptchaTriggerAfterFailures, Integer loginCaptchaExpireSeconds, Integer loginCaptchaMaxAttempts) {}
  public record BrandingResponse(String appName, String theme, String logo, long version, String subtitle,
      String backgroundMode, String backgroundColor, List<String> backgroundImages, int backgroundIntervalSeconds,
      double backgroundOverlay, String backgroundPosition, Map<String,Object> captchaPolicy) {}

  @GetMapping("/company-logo")
  public Map<String, Object> companyLogo() {
    return Map.of("value", settings.findById(COMPANY_LOGO).map(SystemSetting::getSettingValue).filter(v -> v != null && !v.isBlank()).orElse("/icon.jpg"));
  }

  @GetMapping
  public Map<String, Object> getSettings() {
    var result = new LinkedHashMap<String, Object>();
    result.put("appName", value("app_name", "SLSS - 服务器全生命周期系统"));
    result.put("theme", value("theme", "green"));
    result.put("maintenanceMode", Boolean.parseBoolean(value("maintenance_mode", "false")));
    result.put("logRetentionDays", retentionDays());
    result.put("version", settings.findById("app_name").map(SystemSetting::getVersion).orElse(0L));
    result.put("loginSubtitle", value("login_subtitle", "统一管理生产、售后、资产生命周期与交付风险。"));
    result.put("loginBackgroundMode", value("login_background_mode", "single"));
    result.put("loginBackgroundColor", value("login_background_color", "#0f172a"));
    result.put("loginBackgroundImages", backgroundImages());
    result.put("loginBackgroundIntervalSeconds", boundedInt("login_background_interval", 8, 3, 120));
    result.put("loginBackgroundOverlay", boundedInt("login_background_overlay", 58, 0, 90));
    result.put("loginBackgroundPosition", value("login_background_position", "center"));
    result.put("loginCaptchaEnabled", Boolean.parseBoolean(value("login_captcha_enabled", "true")));
    result.put("loginCaptchaTriggerAfterFailures", boundedInt("login_captcha_trigger", 3, 1, 20));
    result.put("loginCaptchaExpireSeconds", boundedInt("login_captcha_expire", 120, 30, 900));
    result.put("loginCaptchaMaxAttempts", boundedInt("login_captcha_max_attempts", 5, 1, 10));
    return result;
  }

  /** Public, non-secret branding payload used by the login shell and app chrome. */
  @GetMapping("/branding")
  public BrandingResponse branding() {
    return new BrandingResponse(value("app_name", "SLSS - 服务器全生命周期系统"), value("theme", "green"), value(COMPANY_LOGO, "/icon.jpg"), settings.findById("app_name").map(SystemSetting::getVersion).orElse(0L), value("login_subtitle", "统一管理生产、售后、资产生命周期与交付风险。"), value("login_background_mode", "single"), value("login_background_color", "#0f172a"), backgroundImages(), boundedInt("login_background_interval", 8, 3, 120), boundedInt("login_background_overlay", 58, 0, 90) / 100.0, value("login_background_position", "center"), Map.of("enabled", Boolean.parseBoolean(value("login_captcha_enabled", "true")), "triggerAfterFailures", boundedInt("login_captcha_trigger", 3, 1, 20), "expireSeconds", boundedInt("login_captcha_expire", 120, 30, 900), "maxAttempts", boundedInt("login_captcha_max_attempts", 5, 1, 10)));
  }

  @PutMapping
  @PreAuthorize("hasAuthority('PERM_MANAGE_SYSTEM')")
  @Transactional
  public Map<String, Object> updateSettings(@Valid @RequestBody SettingsUpdateRequest request, java.security.Principal actor, jakarta.servlet.http.HttpServletRequest http) {
    checkVersion(request.version());
    snapshot(actor == null ? "system" : actor.getName());
    save("app_name", request.appName().trim());
    save("theme", request.theme());
    save("maintenance_mode", String.valueOf(Boolean.TRUE.equals(request.maintenanceMode())));
    save("log_retention_days", String.valueOf(request.logRetentionDays()));
    if (request.loginSubtitle() != null) save("login_subtitle", request.loginSubtitle().trim());
    if (request.loginBackgroundMode() != null) save("login_background_mode", request.loginBackgroundMode());
    if (request.loginBackgroundColor() != null) save("login_background_color", request.loginBackgroundColor());
    if (request.loginBackgroundImages() != null) save("login_background_images", request.loginBackgroundImages());
    if (request.loginBackgroundIntervalSeconds() != null) save("login_background_interval", String.valueOf(Math.max(3, Math.min(120, request.loginBackgroundIntervalSeconds()))));
    if (request.loginBackgroundOverlay() != null) save("login_background_overlay", String.valueOf(Math.max(0, Math.min(90, request.loginBackgroundOverlay()))));
    if (request.loginBackgroundPosition() != null) save("login_background_position", request.loginBackgroundPosition());
    if (request.loginCaptchaEnabled() != null) save("login_captcha_enabled", String.valueOf(request.loginCaptchaEnabled()));
    if (request.loginCaptchaTriggerAfterFailures() != null) save("login_captcha_trigger", String.valueOf(Math.max(1, Math.min(20, request.loginCaptchaTriggerAfterFailures()))));
    if (request.loginCaptchaExpireSeconds() != null) save("login_captcha_expire", String.valueOf(Math.max(30, Math.min(900, request.loginCaptchaExpireSeconds()))));
    if (request.loginCaptchaMaxAttempts() != null) save("login_captcha_max_attempts", String.valueOf(Math.max(1, Math.min(10, request.loginCaptchaMaxAttempts()))));
    audit.record(actor == null ? "system" : actor.getName(), "SYSTEM_SETTINGS_UPDATE", "SYSTEM_SETTINGS", "global", request.toString(), http.getRemoteAddr(), true);
    return getSettings();
  }

  @GetMapping("/branding/history")
  @PreAuthorize("hasAuthority('PERM_MANAGE_SYSTEM')")
  public java.util.List<BrandingHistory> brandingHistory() { return brandingHistory.findTop20ByOrderByCreatedAtDesc(); }

  @PostMapping("/branding/rollback/{id}")
  @PreAuthorize("hasAuthority('PERM_MANAGE_SYSTEM')")
  @Transactional
  public BrandingResponse rollback(@PathVariable Long id, java.security.Principal actor, jakarta.servlet.http.HttpServletRequest http) {
    var previous = brandingHistory.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "品牌版本不存在"));
    snapshot(actor == null ? "system" : actor.getName());
    saveRaw("app_name", previous.getAppName()); saveRaw("theme", previous.getTheme()); saveRaw(COMPANY_LOGO, previous.getLogoData() == null ? "" : previous.getLogoData());
    audit.record(actor == null ? "system" : actor.getName(), "SYSTEM_BRANDING_ROLLBACK", "SYSTEM_SETTINGS", String.valueOf(id), "branding rollback", http.getRemoteAddr(), true);
    return branding();
  }

  private String value(String key, String fallback) { return settings.findById(key).map(SystemSetting::getSettingValue).filter(v -> v != null && !v.isBlank()).orElse(fallback); }
  private int retentionDays() {
    try {
      int days = Integer.parseInt(value("log_retention_days", "90"));
      return days >= 1 && days <= 3650 ? days : 90;
    } catch (RuntimeException ignored) { return 90; }
  }
  private int boundedInt(String key, int fallback, int min, int max) { try { return Math.max(min, Math.min(max, Integer.parseInt(value(key, String.valueOf(fallback))))); } catch (RuntimeException ex) { return fallback; } }
  private List<String> backgroundImages() {
    var raw = value("login_background_images", "[\"/login-backgrounds/logo.jpg\"]");
    try { return new ObjectMapper().readValue(raw, new com.fasterxml.jackson.core.type.TypeReference<List<String>>() {}); }
    catch (Exception ex) { return new ArrayList<>(); }
  }
  private void save(String key, String value) {
    if (!PUBLIC_KEYS.contains(key)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "不允许修改的系统参数");
    saveRaw(key, value);
  }
  private void saveRaw(String key, String value) {
    var setting = settings.findById(key).orElseGet(() -> { var item = new SystemSetting(); item.setSettingKey(key); return item; });
    setting.setSettingValue(value); setting.setUpdatedAt(Instant.now()); settings.save(setting);
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
    snapshot(actor == null ? "system" : actor.getName());
    var setting = settings.findById(COMPANY_LOGO).orElseGet(() -> { var item = new SystemSetting(); item.setSettingKey(COMPANY_LOGO); return item; });
    setting.setSettingValue(value); setting.setUpdatedAt(Instant.now()); settings.save(setting);
    audit.record(actor == null ? "system" : actor.getName(), "SYSTEM_BRANDING_LOGO_UPDATE", "SYSTEM_SETTINGS", COMPANY_LOGO, "logo updated", http.getRemoteAddr(), true);
    return Map.of("value", value, "updatedAt", setting.getUpdatedAt());
  }

  private void checkVersion(Long requested) {
    if (requested == null) return;
    long actual = settings.findById("app_name").map(SystemSetting::getVersion).orElse(0L);
    if (requested.longValue() != actual) throw new ResponseStatusException(HttpStatus.CONFLICT, "系统参数已被其他管理员修改，请刷新后重试");
  }

  private void snapshot(String actor) {
    var h = new BrandingHistory(); h.setAppName(value("app_name", "SLSS - 服务器全生命周期系统")); h.setTheme(value("theme", "green")); h.setLogoData(value(COMPANY_LOGO, "")); h.setCreatedBy(actor); brandingHistory.save(h);
  }
}
