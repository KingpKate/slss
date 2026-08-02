package com.slss.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.slss.domain.SystemSetting;
import com.slss.repository.SystemSettingRepository;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.util.LinkedHashMap;
import java.util.Map;

@Service
public class AiGatewayService {
  private static final String DEFAULT_MODEL = "gemini-2.5-flash";
  private final SystemSettingRepository settings;
  private final RestClient http;
  private final ObjectMapper json;
  private final AiChannelService channels;

  public AiGatewayService(SystemSettingRepository settings, RestClient.Builder builder, ObjectMapper json, AiChannelService channels) {
    this.settings = settings;
    this.http = builder.build();
    this.json = json;
    this.channels = channels;
  }

  public String test(Map<String, String> override) {
    var config = config(override);
    var content = generate(config, "Reply with 'OK' only.", "You are a test bot.");
    if (content == null || content.isBlank()) throw new IllegalStateException("AI 返回为空");
    return "Connection Successful";
  }

  public Map<String, Object> analyze(String faultDescription, String machineConfig, String logs) {
    var prompt = "机器配置:\n" + safe(machineConfig) + "\n\n故障描述:\n" + safe(faultDescription)
        + (logs == null || logs.isBlank() ? "" : "\n\n系统日志:\n" + logs)
        + "\n\n请使用中文分析并返回纯 JSON，包含 summary（字符串）、possibleCauses（字符串数组）、recommendation（字符串）。";
    var raw = generate(config(Map.of()), prompt, "你是服务器硬件专家，只输出有效 JSON。");
    try {
      JsonNode node = json.readTree(stripMarkdown(raw));
      var result = new LinkedHashMap<String, Object>();
      result.put("summary", node.path("summary").asText(""));
      var causes = new java.util.ArrayList<String>();
      node.path("possibleCauses").forEach(item -> causes.add(item.asText()));
      result.put("possibleCauses", causes);
      result.put("recommendation", node.path("recommendation").asText(""));
      return result;
    } catch (Exception ex) {
      throw new IllegalStateException("AI 返回的内容不是有效 JSON");
    }
  }

  private String generate(Map<String, String> config, String prompt, String systemPrompt) {
    if (config.isEmpty()) {
      var routed = channels.generate(prompt, systemPrompt);
      if (routed != null) return routed;
    }
    var provider = config.getOrDefault("provider", "google");
    var model = config.getOrDefault("model", DEFAULT_MODEL);
    var apiKey = config.getOrDefault("apiKey", "");
    if (apiKey.isBlank()) throw new IllegalStateException("未配置 AI API 密钥");
    if ("google".equals(provider) && config.getOrDefault("baseUrl", "").isBlank()) {
      var endpoint = "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + apiKey;
      var body = Map.of("contents", java.util.List.of(Map.of("parts", java.util.List.of(Map.of("text", systemPrompt + "\n" + prompt)))));
      var response = http.post().uri(endpoint).contentType(MediaType.APPLICATION_JSON).body(body).retrieve().body(JsonNode.class);
      return response == null ? "" : response.at("/candidates/0/content/parts/0/text").asText("");
    }
    var baseUrl = config.getOrDefault("baseUrl", "").replaceAll("/+$", "");
    if (baseUrl.isBlank()) throw new IllegalStateException("当前 AI 渠道需要配置接口地址");
    var endpoint = baseUrl.endsWith("/chat/completions") ? baseUrl : baseUrl + "/chat/completions";
    var body = Map.of("model", model, "temperature", 0.2, "messages", java.util.List.of(
        Map.of("role", "system", "content", systemPrompt), Map.of("role", "user", "content", prompt)));
    var response = http.post().uri(endpoint).contentType(MediaType.APPLICATION_JSON).header("Authorization", "Bearer " + apiKey).body(body).retrieve().body(JsonNode.class);
    return response == null ? "" : response.at("/choices/0/message/content").asText("");
  }

  private Map<String, String> config(Map<String, String> override) {
    var result = new LinkedHashMap<String, String>();
    result.put("provider", override.getOrDefault("provider", value("ai_provider", "google")));
    result.put("model", override.getOrDefault("model", value("ai_model", DEFAULT_MODEL)));
    result.put("baseUrl", override.getOrDefault("baseUrl", value("ai_base_url", "")));
    result.put("apiKey", override.getOrDefault("apiKey", value("ai_api_key", "")));
    return result;
  }

  private String value(String key, String fallback) { return settings.findById(key).map(SystemSetting::getSettingValue).filter(v -> v != null && !v.isBlank()).orElse(fallback); }
  private static String safe(String value) { return value == null ? "" : value.length() > 12000 ? value.substring(0, 12000) : value; }
  private static String stripMarkdown(String raw) { return raw == null ? "" : raw.replaceFirst("^```json\\s*", "").replaceFirst("^```\\s*", "").replaceFirst("\\s*```$", "").trim(); }
}
