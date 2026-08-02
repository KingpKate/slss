package com.slss.domain;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "ai_channels", indexes = {
    @Index(name = "idx_ai_channels_enabled_priority", columnList = "enabled,priority")
})
public class AiChannel {
  @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;
  @Column(nullable = false, length = 80) private String name;
  @Column(nullable = false, length = 32) private String provider = "custom";
  @Column(nullable = false, length = 32) private String protocol = "OPENAI_COMPATIBLE";
  @Column(name = "base_url", nullable = false, length = 500) private String baseUrl;
  @Column(nullable = false, length = 160) private String model;
  @Lob @Column(name = "headers_json", columnDefinition = "LONGTEXT") private String headersJson = "{}";
  @Lob @Column(name = "model_mapping_json", columnDefinition = "LONGTEXT") private String modelMappingJson = "{}";
  @Lob @Column(name = "encrypted_api_key", columnDefinition = "LONGTEXT") private String encryptedApiKey;
  @Column(nullable = false) private boolean enabled = true;
  @Column(nullable = false) private int priority = 100;
  @Column(nullable = false) private int weight = 100;
  @Column(nullable = false) private int timeoutMs = 30000;
  @Column(name = "last_status", length = 24) private String lastStatus = "UNKNOWN";
  @Column(name = "last_error", length = 500) private String lastError;
  @Column(name = "last_test_at") private Instant lastTestAt;
  @Version @Column(nullable = false) private long version;
  @Column(name = "created_at", nullable = false) private Instant createdAt = Instant.now();
  @Column(name = "updated_at", nullable = false) private Instant updatedAt = Instant.now();

  @PreUpdate void touch() { updatedAt = Instant.now(); }
  public Long getId() { return id; } public void setId(Long v) { id = v; }
  public String getName() { return name; } public void setName(String v) { name = v; }
  public String getProvider() { return provider; } public void setProvider(String v) { provider = v; }
  public String getProtocol() { return protocol; } public void setProtocol(String v) { protocol = v; }
  public String getBaseUrl() { return baseUrl; } public void setBaseUrl(String v) { baseUrl = v; }
  public String getModel() { return model; } public void setModel(String v) { model = v; }
  public String getHeadersJson() { return headersJson; } public void setHeadersJson(String v) { headersJson = v; }
  public String getModelMappingJson() { return modelMappingJson; } public void setModelMappingJson(String v) { modelMappingJson = v; }
  public String getEncryptedApiKey() { return encryptedApiKey; } public void setEncryptedApiKey(String v) { encryptedApiKey = v; }
  public boolean isEnabled() { return enabled; } public void setEnabled(boolean v) { enabled = v; }
  public int getPriority() { return priority; } public void setPriority(int v) { priority = v; }
  public int getWeight() { return weight; } public void setWeight(int v) { weight = v; }
  public int getTimeoutMs() { return timeoutMs; } public void setTimeoutMs(int v) { timeoutMs = v; }
  public String getLastStatus() { return lastStatus; } public void setLastStatus(String v) { lastStatus = v; }
  public String getLastError() { return lastError; } public void setLastError(String v) { lastError = v; }
  public Instant getLastTestAt() { return lastTestAt; } public void setLastTestAt(Instant v) { lastTestAt = v; }
  public long getVersion() { return version; } public void setVersion(long v) { version = v; }
  public Instant getCreatedAt() { return createdAt; } public Instant getUpdatedAt() { return updatedAt; }
}
