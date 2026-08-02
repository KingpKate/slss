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
      // Model discovery is part of the connectivity test.  A newly created
      // OpenAI-compatible channel commonly has no model configured yet; do
      // not fail with a misleading 409 in that case. Discover the remote
      // catalog, persist a deterministic first model, then perform the test
      // request using the persisted channel configuration.
      ensureModel(channel);
      // Reload the managed entity so subsequent status updates include the
      // model selected by ensureModel even when the repository implementation
      // returns a detached instance in a non-transactional request.
      channel = channels.findById(id).orElse(channel);
      var response = request(channel, "Reply with OK only.", "You are a connectivity test bot.", true);
      channel.setLastStatus("UP"); channel.setLastError(null); channel.setLastTestAt(Instant.now()); channels.save(channel);
      return Map.of("status", "UP", "message", response == null ? "连接成功" : "连接成功", "testedAt", channel.getLastTestAt());
    } catch (Exception ex) {
      channel.setLastStatus("DOWN"); channel.setLastError(trim(ex.getMessage())); channel.setLastTestAt(Instant.now()); channels.save(channel);
      throw new IllegalStateException("AI 渠道连接失败：" + trim(ex.getMessage()), ex);
    }
  }

  /** Routes an application request through the highest-priority enabled channel. */
  public String generate(String prompt, String systemPrompt) {
    var enabled = channels.findByEnabledTrueOrderByPriorityAscIdAsc();
    if (enabled.isEmpty()) return null;
    // Channels at the best priority participate in weighted routing. A failed
    // channel is removed from the current attempt and the next weighted
    // candidate is tried, providing both load distribution and failover.
    int bestPriority = enabled.get(0).getPriority();
    var candidates = new ArrayList<>(enabled.stream().filter(c -> c.getPriority() == bestPriority).toList());
    var fallback = new ArrayList<>(enabled.stream().filter(c -> c.getPriority() != bestPriority).toList());
    Exception last = null;
    while (!candidates.isEmpty() || !fallback.isEmpty()) {
      var pool = candidates.isEmpty() ? fallback : candidates;
      var channel = weightedPick(pool);
      pool.remove(channel);
      try {
        ensureModel(channel);
        return request(channel, prompt, systemPrompt, false);
      }
      catch (Exception ex) { last = ex; channel.setLastStatus("DOWN"); channel.setLastError(trim(ex.getMessage())); channel.setLastTestAt(Instant.now()); channels.save(channel); }
    }
    throw new IllegalStateException("所有启用的 AI 渠道均不可用：" + trim(last == null ? null : last.getMessage()));
  }

  private AiChannel weightedPick(List<AiChannel> pool) {
    int total = pool.stream().mapToInt(c -> Math.max(1, c.getWeight())).sum();
    int cursor = random.nextInt(Math.max(1, total));
    for (var channel : pool) { cursor -= Math.max(1, channel.getWeight()); if (cursor < 0) return channel; }
    return pool.get(pool.size() - 1);
  }

  private void ensureModel(AiChannel channel) {
    if (channel.getModel() != null && !channel.getModel().isBlank()) return;
    var discovered = discoverModelIds(channel);
    if (discovered.isEmpty()) throw new IllegalStateException("远端未返回可用模型，请检查接口地址、API Key 或模型权限");
    channel.setModel(discovered.get(0));
    channels.save(channel);
  }

  public Map<String, Object> models(long id) {
    var channel = channels.findById(id).orElseThrow(() -> new NoSuchElementException("AI 渠道不存在"));
    try {
      if ("ANTHROPIC".equalsIgnoreCase(channel.getProtocol())) {
        var configured = channel.getModel() == null || channel.getModel().isBlank() ? List.<String>of() : List.of(channel.getModel());
        return Map.of("models", configured, "source", "configured", "message", "Anthropic 官方接口不提供模型目录，请在渠道中配置模型");
      }
      var result = discoverModelIds(channel);
      // Model discovery is also the canonical way to initialize a channel.
      // Persist the first remote model here so the next test/chat request does
      // not need a second, stale-version PUT from the browser.
      if ((channel.getModel() == null || channel.getModel().isBlank()) && !result.isEmpty()) {
        channel.setModel(result.get(0));
        channel = channels.save(channel);
      }
      return Map.of("models", result, "source", "remote", "selectedModel", channel.getModel() == null ? "" : channel.getModel(), "version", channel.getVersion());
    } catch (Exception ex) { throw new IllegalStateException("模型发现失败：" + trim(ex.getMessage()), ex); }
  }

  /** Fetch and normalize the model catalog for a channel. */
  private List<String> discoverModelIds(AiChannel channel) {
    var base = channel.getBaseUrl().replaceAll("/+$", "");
    String key = decrypt(channel.getEncryptedApiKey());
    if (key.isBlank()) throw new IllegalStateException("未配置 API 密钥");
    JsonNode data;
    if ("GEMINI".equalsIgnoreCase(channel.getProtocol())) {
      data = http.get().uri(base + "/v1beta/models?key=" + key).headers(h -> headers(channel, h)).retrieve().body(JsonNode.class);
    } else {
      data = http.get().uri(base + "/models").headers(h -> { headers(channel, h); h.setBearerAuth(key); }).retrieve().body(JsonNode.class);
    }
    final var discovered = new ArrayList<String>();
    if (data != null && data.path("data").isArray()) data.path("data").forEach(n -> {
      String modelId = n.path("id").asText(""); if (!modelId.isBlank()) discovered.add(modelId);
    });
    if (data != null && data.path("models").isArray()) data.path("models").forEach(n -> {
      String name = n.path("name").asText(""); if (name.isBlank()) name = n.path("id").asText("");
      if (name.startsWith("models/")) name = name.substring(7); if (!name.isBlank()) discovered.add(name);
    });
    return new ArrayList<>(new LinkedHashSet<>(discovered));
  }

  private AiChannel fill(AiChannel c, Map<String, Object> b, boolean create) {
    String name = text(b, "name", 1, 80); String provider = textOr(b, "provider", "custom", 1, 32);
    String protocol = textOr(b, "protocol", "OPENAI_COMPATIBLE", 1, 32).toUpperCase(Locale.ROOT);
    if (!Set.of("OPENAI_COMPATIBLE", "ANTHROPIC", "GEMINI", "CUSTOM").contains(protocol)) throw new IllegalArgumentException("不支持的 AI 协议");
    c.setName(name); c.setProvider(provider); c.setProtocol(protocol); c.setBaseUrl(text(b, "baseUrl", 1, 500)); c.setModel(textOr(b, "model", "", 0, 160));
    c.setHeadersJson(jsonString(b.get("headers"), "{}")); c.setModelMappingJson(jsonString(b.get("modelMapping"), "{}"));
    if (b.get("enabled") != null) c.setEnabled(Boolean.parseBoolean(String.valueOf(b.get("enabled"))));
    c.setPriority(integer(b.get("priority"), 100, 0, 10000)); c.setWeight(integer(b.get("weight"), 100, 1, 10000)); c.setTimeoutMs(integer(b.get("timeoutMs"), 30000, 1000, 300000));
    String key = b.get("apiKey") == null ? "" : String.valueOf(b.get("apiKey")).trim(); if (!key.isBlank() && !key.startsWith("••••")) c.setEncryptedApiKey(encrypt(key));
    if (create && c.getHeadersJson() == null) c.setHeadersJson("{}"); return c;
  }
  private Map<String, Object> view(AiChannel c) { var m = new LinkedHashMap<String, Object>(); m.put("id", c.getId()); m.put("name", c.getName()); m.put("provider", c.getProvider()); m.put("protocol", c.getProtocol()); m.put("baseUrl", c.getBaseUrl()); m.put("model", c.getModel()); m.put("headers", parse(c.getHeadersJson())); m.put("modelMapping", parse(c.getModelMappingJson())); m.put("enabled", c.isEnabled()); m.put("priority", c.getPriority()); m.put("weight", c.getWeight()); m.put("timeoutMs", c.getTimeoutMs()); m.put("hasApiKey", c.getEncryptedApiKey() != null && !c.getEncryptedApiKey().isBlank()); m.put("apiKeyMasked", mask(c.getEncryptedApiKey())); m.put("lastStatus", c.getLastStatus()); m.put("lastError", c.getLastError()); m.put("lastTestAt", c.getLastTestAt()); m.put("version", c.getVersion()); return m; }
  private String request(AiChannel c, String prompt, String systemPrompt, boolean test) {
    if (c.getModel() == null || c.getModel().isBlank()) throw new IllegalStateException("请先选择或配置模型");
    String key = decrypt(c.getEncryptedApiKey()); if (key.isBlank()) throw new IllegalStateException("未配置 API 密钥");
    String base = c.getBaseUrl().replaceAll("/+$", "");
    if ("GEMINI".equalsIgnoreCase(c.getProtocol())) { var body = Map.of("systemInstruction", Map.of("parts", List.of(Map.of("text", systemPrompt))), "contents", List.of(Map.of("parts", List.of(Map.of("text", prompt))))); var response = http.post().uri(base + "/v1beta/models/" + c.getModel() + ":generateContent?key=" + key).contentType(MediaType.APPLICATION_JSON).body(body).retrieve().body(String.class); return extractContent(response, "GEMINI"); }
    if ("ANTHROPIC".equalsIgnoreCase(c.getProtocol())) { var body = Map.of("system", systemPrompt, "model", c.getModel(), "max_tokens", 1024, "messages", List.of(Map.of("role", "user", "content", prompt))); var response = http.post().uri(base + "/v1/messages").headers(h -> { headers(c, h); h.set("x-api-key", key); h.set("anthropic-version", "2023-06-01"); }).contentType(MediaType.APPLICATION_JSON).body(body).retrieve().body(String.class); return extractContent(response, "ANTHROPIC"); }
    var body = Map.of("model", c.getModel(), "messages", List.of(Map.of("role", "system", "content", systemPrompt), Map.of("role", "user", "content", prompt)), "max_tokens", 1024); var response = http.post().uri(base.endsWith("/chat/completions") ? base : base + "/chat/completions").headers(h -> headers(c, h)).header("Authorization", "Bearer " + key).contentType(MediaType.APPLICATION_JSON).body(body).retrieve().body(String.class); return extractContent(response, "OPENAI");
  }
  private String extractContent(String raw, String protocol) {
    if (raw == null || raw.isBlank()) return "";
    try {
      JsonNode node = json.readTree(raw);
      if ("GEMINI".equals(protocol)) return node.at("/candidates/0/content/parts/0/text").asText(raw);
      if ("ANTHROPIC".equals(protocol)) return node.at("/content/0/text").asText(raw);
      return node.at("/choices/0/message/content").asText(raw);
    } catch (Exception ignored) { return raw; }
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
