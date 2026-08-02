package com.slss.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.slss.domain.AiChannel;
import com.slss.repository.AiChannelRepository;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.*;

@Service
public class AiChannelService {
  private final AiChannelRepository channels;
  private final ObjectMapper json;
  private final RestClient http;
  private final byte[] cryptoKey;
  private final SecureRandom random = new SecureRandom();

  public AiChannelService(AiChannelRepository channels, ObjectMapper json, RestClient.Builder builder,
      @org.springframework.beans.factory.annotation.Value("${slss.security.jwt-secret}") String secret) {
    this.channels = channels; this.json = json; this.http = builder.build();
    try { cryptoKey = MessageDigest.getInstance("SHA-256").digest((secret + "|slss-ai-channel").getBytes(StandardCharsets.UTF_8)); }
    catch (Exception e) { throw new IllegalStateException("无法初始化 AI 密钥加密器", e); }
  }

  public List<Map<String, Object>> list() { return channels.findAllByOrderByPriorityAscIdAsc().stream().map(this::view).toList(); }
  public Map<String, Object> create(Map<String, Object> body) { return view(channels.save(fill(new AiChannel(), body, true))); }
  public Map<String, Object> update(long id, Map<String, Object> body) {
    var channel = channels.findById(id).orElseThrow(() -> new NoSuchElementException("AI 渠道不存在"));
    if (body.get("version") != null && Long.parseLong(String.valueOf(body.get("version"))) != channel.getVersion()) throw new IllegalStateException("AI 渠道已被其他管理员修改，请刷新后重试");
    return view(channels.save(fill(channel, body, false)));
  }
  public void delete(long id) { channels.deleteById(id); }

  public Map<String, Object> test(long id) {
    var channel = channels.findById(id).orElseThrow(() -> new NoSuchElementException("AI 渠道不存在"));
    try {
      var response = request(channel, "Reply with OK only.", true);
      channel.setLastStatus("UP"); channel.setLastError(null); channel.setLastTestAt(Instant.now()); channels.save(channel);
      return Map.of("status", "UP", "message", response == null ? "连接成功" : "连接成功", "testedAt", channel.getLastTestAt());
    } catch (Exception ex) {
      channel.setLastStatus("DOWN"); channel.setLastError(trim(ex.getMessage())); channel.setLastTestAt(Instant.now()); channels.save(channel);
      throw new IllegalStateException("AI 渠道连接失败：" + trim(ex.getMessage()), ex);
    }
  }

  public Map<String, Object> models(long id) {
    var channel = channels.findById(id).orElseThrow(() -> new NoSuchElementException("AI 渠道不存在"));
    try {
      if (!"OPENAI_COMPATIBLE".equalsIgnoreCase(channel.getProtocol())) return Map.of("models", List.of(channel.getModel()), "source", "configured");
      var base = channel.getBaseUrl().replaceAll("/+$", "");
      JsonNode data = http.get().uri(base + "/models").headers(h -> headers(channel, h)).retrieve().body(JsonNode.class);
      var result = new ArrayList<String>(); if (data != null && data.path("data").isArray()) data.path("data").forEach(n -> result.add(n.path("id").asText()));
      return Map.of("models", result.isEmpty() ? List.of(channel.getModel()) : result, "source", "remote");
    } catch (Exception ex) { throw new IllegalStateException("模型发现失败：" + trim(ex.getMessage()), ex); }
  }

  private AiChannel fill(AiChannel c, Map<String, Object> b, boolean create) {
    String name = text(b, "name", 1, 80); String provider = textOr(b, "provider", "custom", 1, 32);
    String protocol = textOr(b, "protocol", "OPENAI_COMPATIBLE", 1, 32).toUpperCase(Locale.ROOT);
    if (!Set.of("OPENAI_COMPATIBLE", "ANTHROPIC", "GEMINI", "CUSTOM").contains(protocol)) throw new IllegalArgumentException("不支持的 AI 协议");
    c.setName(name); c.setProvider(provider); c.setProtocol(protocol); c.setBaseUrl(text(b, "baseUrl", 1, 500)); c.setModel(text(b, "model", 1, 160));
    c.setHeadersJson(jsonString(b.get("headers"), "{}")); c.setModelMappingJson(jsonString(b.get("modelMapping"), "{}"));
    if (b.get("enabled") != null) c.setEnabled(Boolean.parseBoolean(String.valueOf(b.get("enabled"))));
    c.setPriority(integer(b.get("priority"), 100, 0, 10000)); c.setWeight(integer(b.get("weight"), 100, 1, 10000)); c.setTimeoutMs(integer(b.get("timeoutMs"), 30000, 1000, 300000));
    String key = b.get("apiKey") == null ? "" : String.valueOf(b.get("apiKey")).trim(); if (!key.isBlank() && !key.startsWith("••••")) c.setEncryptedApiKey(encrypt(key));
    if (create && c.getHeadersJson() == null) c.setHeadersJson("{}"); return c;
  }
  private Map<String, Object> view(AiChannel c) { var m = new LinkedHashMap<String, Object>(); m.put("id", c.getId()); m.put("name", c.getName()); m.put("provider", c.getProvider()); m.put("protocol", c.getProtocol()); m.put("baseUrl", c.getBaseUrl()); m.put("model", c.getModel()); m.put("headers", parse(c.getHeadersJson())); m.put("modelMapping", parse(c.getModelMappingJson())); m.put("enabled", c.isEnabled()); m.put("priority", c.getPriority()); m.put("weight", c.getWeight()); m.put("timeoutMs", c.getTimeoutMs()); m.put("hasApiKey", c.getEncryptedApiKey() != null && !c.getEncryptedApiKey().isBlank()); m.put("apiKeyMasked", mask(c.getEncryptedApiKey())); m.put("lastStatus", c.getLastStatus()); m.put("lastError", c.getLastError()); m.put("lastTestAt", c.getLastTestAt()); m.put("version", c.getVersion()); return m; }
  private String request(AiChannel c, String prompt, boolean test) {
    String key = decrypt(c.getEncryptedApiKey()); if (key.isBlank()) throw new IllegalStateException("未配置 API 密钥");
    String base = c.getBaseUrl().replaceAll("/+$", "");
    if ("GEMINI".equalsIgnoreCase(c.getProtocol())) { var body = Map.of("contents", List.of(Map.of("parts", List.of(Map.of("text", prompt))))); return http.post().uri(base + "/v1beta/models/" + c.getModel() + ":generateContent?key=" + key).contentType(MediaType.APPLICATION_JSON).body(body).retrieve().body(String.class); }
    if ("ANTHROPIC".equalsIgnoreCase(c.getProtocol())) { var body = Map.of("model", c.getModel(), "max_tokens", 16, "messages", List.of(Map.of("role", "user", "content", prompt))); return http.post().uri(base + "/v1/messages").headers(h -> { headers(c, h); h.set("x-api-key", key); h.set("anthropic-version", "2023-06-01"); }).contentType(MediaType.APPLICATION_JSON).body(body).retrieve().body(String.class); }
    var body = Map.of("model", c.getModel(), "messages", List.of(Map.of("role", "user", "content", prompt)), "max_tokens", 16); return http.post().uri(base.endsWith("/chat/completions") ? base : base + "/chat/completions").headers(h -> headers(c, h)).header("Authorization", "Bearer " + key).contentType(MediaType.APPLICATION_JSON).body(body).retrieve().body(String.class);
  }
  private void headers(AiChannel c, org.springframework.http.HttpHeaders h) { parse(c.getHeadersJson()).forEach((k, v) -> h.set(k, String.valueOf(v))); }
  private String encrypt(String value) { try { byte[] iv = new byte[12]; random.nextBytes(iv); Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding"); cipher.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(cryptoKey, "AES"), new GCMParameterSpec(128, iv)); return Base64.getEncoder().encodeToString(iv) + ":" + Base64.getEncoder().encodeToString(cipher.doFinal(value.getBytes(StandardCharsets.UTF_8))); } catch (Exception e) { throw new IllegalStateException("AI 密钥加密失败", e); } }
  private String decrypt(String value) { if (value == null || value.isBlank()) return ""; try { var p = value.split(":", 2); Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding"); cipher.init(Cipher.DECRYPT_MODE, new SecretKeySpec(cryptoKey, "AES"), new GCMParameterSpec(128, Base64.getDecoder().decode(p[0]))); return new String(cipher.doFinal(Base64.getDecoder().decode(p[1])), StandardCharsets.UTF_8); } catch (Exception e) { return ""; } }
  private Map<String, Object> parse(String value) { try { return json.readValue(value == null || value.isBlank() ? "{}" : value, new TypeReference<>() {}); } catch (Exception e) { return Map.of(); } }
  private String jsonString(Object value, String fallback) { if (value == null) return fallback; try { return value instanceof String s ? json.readTree(s).toString() : json.writeValueAsString(value); } catch (Exception e) { throw new IllegalArgumentException("JSON 配置格式不正确"); } }
  private static String text(Map<String,Object> b, String key, int min, int max) { return textOr(b, key, "", min, max); }
  private static String textOr(Map<String,Object> b, String key, String fallback, int min, int max) { String v = b.get(key) == null ? fallback : String.valueOf(b.get(key)).trim(); if (v.length() < min || v.length() > max) throw new IllegalArgumentException(key + " 长度不合法"); return v; }
  private static int integer(Object v, int fallback, int min, int max) { try { int n = v == null ? fallback : Integer.parseInt(String.valueOf(v)); if (n < min || n > max) throw new IllegalArgumentException("数值超出范围"); return n; } catch (NumberFormatException e) { throw new IllegalArgumentException("数值格式不正确"); } }
  private static String mask(String value) { return value == null || value.isBlank() ? "" : "••••••••"; }
  private static String trim(String value) { return value == null || value.isBlank() ? "未知错误" : value.length() > 500 ? value.substring(0, 500) : value; }
}
