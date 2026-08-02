package com.slss.domain;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "branding_history", indexes = @Index(name = "idx_branding_history_created", columnList = "created_at"))
public class BrandingHistory {
  @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
  @Column(name="app_name", nullable=false, length=120) private String appName;
  @Column(nullable=false, length=32) private String theme;
  @Lob @Column(name="logo_data", columnDefinition="LONGTEXT") private String logoData;
  @Column(name="created_by", nullable=false, length=100) private String createdBy;
  @Column(name="created_at", nullable=false) private Instant createdAt = Instant.now();
  public Long getId(){return id;} public String getAppName(){return appName;} public void setAppName(String v){appName=v;}
  public String getTheme(){return theme;} public void setTheme(String v){theme=v;} public String getLogoData(){return logoData;} public void setLogoData(String v){logoData=v;}
  public String getCreatedBy(){return createdBy;} public void setCreatedBy(String v){createdBy=v;} public Instant getCreatedAt(){return createdAt;}
}
