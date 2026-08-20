package com.slss.domain;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

/** Database-backed staging record for preview-before-confirm Excel imports. */
@Entity
@Table(name = "performance_import_previews")
public class PerformanceImportPreview {
  @Id
  @Column(length = 36)
  private String token = UUID.randomUUID().toString();
  @Lob
  @Column(name = "workbook_data", nullable = false, columnDefinition = "LONGBLOB")
  private byte[] workbookData;
  @Column(name = "original_filename", nullable = false, length = 255)
  private String originalFilename;
  @Column(nullable = false, length = 20)
  private String status = "PENDING";
  @Column(name = "expires_at", nullable = false)
  private Instant expiresAt;
  @Column(name = "created_at", nullable = false)
  private Instant createdAt = Instant.now();
  protected PerformanceImportPreview() {}
  public PerformanceImportPreview(byte[] data, String filename, Instant expiresAt) {
    this.workbookData = data; this.originalFilename = filename; this.expiresAt = expiresAt;
  }
  public String getToken(){ return token; }
  public byte[] getWorkbookData(){ return workbookData; }
  public String getOriginalFilename(){ return originalFilename; }
  public String getStatus(){ return status; }
  public void setStatus(String value){ status=value; }
  public Instant getExpiresAt(){ return expiresAt; }
}
