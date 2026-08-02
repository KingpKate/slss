package com.slss.domain;
import jakarta.persistence.*; import java.time.Instant;
@Entity @Table(name="login_background_assets", indexes=@Index(name="idx_login_background_assets_enabled", columnList="enabled,sort_order,created_at"))
public class LoginBackgroundAsset {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
 @Column(name="file_name",nullable=false,length=255) private String fileName;
 @Column(name="mime_type",nullable=false,length=64) private String mimeType;
 @Column(name="file_size",nullable=false) private long fileSize;
 @Column(nullable=false) private int width; @Column(nullable=false) private int height;
 @Column(nullable=false,length=64) private String sha256; @Column(name="sort_order",nullable=false) private int sortOrder;
 @Column(nullable=false) private boolean enabled=true; @Lob @Basic(fetch=FetchType.LAZY) @Column(name="image_data",nullable=false,columnDefinition="LONGBLOB") private byte[] imageData;
 @Column(name="created_by",nullable=false,length=100) private String createdBy; @Column(name="created_at",nullable=false) private Instant createdAt=Instant.now(); @Column(name="updated_at",nullable=false) private Instant updatedAt=Instant.now();
 public Long getId(){return id;} public String getFileName(){return fileName;} public void setFileName(String v){fileName=v;} public String getMimeType(){return mimeType;} public void setMimeType(String v){mimeType=v;} public long getFileSize(){return fileSize;} public void setFileSize(long v){fileSize=v;} public int getWidth(){return width;} public void setWidth(int v){width=v;} public int getHeight(){return height;} public void setHeight(int v){height=v;} public String getSha256(){return sha256;} public void setSha256(String v){sha256=v;} public int getSortOrder(){return sortOrder;} public void setSortOrder(int v){sortOrder=v;} public boolean isEnabled(){return enabled;} public void setEnabled(boolean v){enabled=v;} public byte[] getImageData(){return imageData;} public void setImageData(byte[] v){imageData=v;} public String getCreatedBy(){return createdBy;} public void setCreatedBy(String v){createdBy=v;} public Instant getCreatedAt(){return createdAt;} public Instant getUpdatedAt(){return updatedAt;} public void setUpdatedAt(Instant v){updatedAt=v;}
}
