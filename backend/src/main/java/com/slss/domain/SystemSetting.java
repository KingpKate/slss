package com.slss.domain;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "system_settings")
public class SystemSetting {
  @Id
  @Column(length = 100)
  private String settingKey;
  @Lob
  @Column(name = "setting_value", columnDefinition = "LONGTEXT")
  private String settingValue;
  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt = Instant.now();
  @Version
  @Column(nullable = false)
  private long version;

  public String getSettingKey() { return settingKey; }
  public void setSettingKey(String value) { settingKey = value; }
  public String getSettingValue() { return settingValue; }
  public void setSettingValue(String value) { settingValue = value; }
  public Instant getUpdatedAt() { return updatedAt; }
  public void setUpdatedAt(Instant value) { updatedAt = value; }
  public long getVersion() { return version; }
  public void setVersion(long value) { version = value; }
}
