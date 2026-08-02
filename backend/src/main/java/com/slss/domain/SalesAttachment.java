package com.slss.domain;
import jakarta.persistence.*; import java.time.Instant;
@Entity @Table(name="sales_attachments") public class SalesAttachment {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
 @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="initiation_id",nullable=false) private SalesInitiation initiation;
 @Column(name="file_name",nullable=false) private String fileName; @Column(name="storage_key",nullable=false) private String storageKey;
 @Column(name="content_type") private String contentType; @Column(name="file_size",nullable=false) private long fileSize;
 @Column(name="uploaded_by",nullable=false) private String uploadedBy; @Column(name="created_at",nullable=false) private Instant createdAt=Instant.now();
 public Long getId(){return id;} public Long getInitiationId(){return initiation.getId();} public String getFileName(){return fileName;} public String getStorageKey(){return storageKey;} public String getContentType(){return contentType;} public long getFileSize(){return fileSize;} public String getUploadedBy(){return uploadedBy;} public Instant getCreatedAt(){return createdAt;} public void setInitiation(SalesInitiation v){initiation=v;} public void setFileName(String v){fileName=v;} public void setStorageKey(String v){storageKey=v;} public void setContentType(String v){contentType=v;} public void setFileSize(long v){fileSize=v;} public void setUploadedBy(String v){uploadedBy=v;}
}
