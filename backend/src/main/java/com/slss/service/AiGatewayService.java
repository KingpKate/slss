package com.slss.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.Map;

@Service
public class AiGatewayService {
  private final ObjectMapper json;
  private final AiChannelService channels;

  public AiGatewayService(ObjectMapper json, AiChannelService channels) {
    this.json = json;
    this.channels = channels;
  }

  public String test() {
    var content = channels.generate("Reply with 'OK' only.", "You are a test bot.");
    if (content == null || content.isBlank()) throw new IllegalStateException("未配置启用的 AI 渠道或 AI 返回为空");
    return "Connection Successful";
  }

  public Map<String, Object> analyze(String faultDescription, String machineConfig, String logs) {
    var prompt = "机器配置:\n" + safe(machineConfig) + "\n\n故障描述:\n" + safe(faultDescription)
        + (logs == null || logs.isBlank() ? "" : "\n\n系统日志:\n" + logs)
        + "\n\n请使用中文分析并返回纯 JSON，包含 summary（字符串）、possibleCauses（字符串数组）、recommendation（字符串）。";
    var raw = channels.generate(prompt, "你是服务器硬件专家，只输出有效 JSON。");
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

  private static String safe(String value) { return value == null ? "" : value.length() > 12000 ? value.substring(0, 12000) : value; }
  private static String stripMarkdown(String raw) { return raw == null ? "" : raw.replaceFirst("^```json\\s*", "").replaceFirst("^```\\s*", "").replaceFirst("\\s*```$", "").trim(); }
}
