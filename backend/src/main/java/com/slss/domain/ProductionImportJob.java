package com.slss.domain;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.time.Instant;

@Entity
@Table(name = "production_import_jobs")
public class ProductionImportJob {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
 @Column(name="batch_name",nullable=false) private String batchName;
 @Column(name="file_name",nullable=false) private String fileName;
 @Column(nullable=false) private String status="QUEUED";
 @Column(name="total_rows") private int totalRows;
 @Column(name="success_rows") private int successRows;
 @Column(name="failed_rows") private int failedRows;
 @Column(name="error_message",columnDefinition="TEXT") private String errorMessage;
 @Column(name="created_by") private String createdBy;
 @Column(name="created_at") private Instant createdAt=Instant.now();
 @Column(name="started_at") private Instant startedAt;
 @Column(name="finished_at") private Instant finishedAt;
 @Basic(fetch=FetchType.LAZY) @Column(name="input_data",columnDefinition="LONGBLOB") @JdbcTypeCode(SqlTypes.LONGVARBINARY) private byte[] inputData;
 @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="retry_of") private ProductionImportJob retryOf;
 @Column(name="retry_count",nullable=false) private int retryCount;
 @Column(name="max_retries",nullable=false) private int maxRetries=3;
 @Column(name="next_attempt_at") private Instant nextAttemptAt;
 @Column(name="last_heartbeat_at") private Instant lastHeartbeatAt;
 public Long getId(){return id;} public String getBatchName(){return batchName;} public String getFileName(){return fileName;} public String getStatus(){return status;} public int getTotalRows(){return totalRows;} public int getSuccessRows(){return successRows;} public int getFailedRows(){return failedRows;} public String getErrorMessage(){return errorMessage;} public String getCreatedBy(){return createdBy;} public Instant getCreatedAt(){return createdAt;} public Instant getStartedAt(){return startedAt;} public Instant getFinishedAt(){return finishedAt;} public byte[] getInputData(){return inputData;} public ProductionImportJob getRetryOf(){return retryOf;} public int getRetryCount(){return retryCount;} public int getMaxRetries(){return maxRetries;} public Instant getNextAttemptAt(){return nextAttemptAt;} public Instant getLastHeartbeatAt(){return lastHeartbeatAt;}
 public void setBatchName(String v){batchName=v;} public void setFileName(String v){fileName=v;} public void setStatus(String v){status=v;} public void setErrorMessage(String v){errorMessage=v;} public void setCreatedBy(String v){createdBy=v;} public void setStartedAt(Instant v){startedAt=v;} public void setFinishedAt(Instant v){finishedAt=v;} public void setTotalRows(int v){totalRows=v;} public void setSuccessRows(int v){successRows=v;} public void setFailedRows(int v){failedRows=v;} public void setInputData(byte[] v){inputData=v;} public void setRetryOf(ProductionImportJob v){retryOf=v;} public void setRetryCount(int v){retryCount=v;} public void setMaxRetries(int v){maxRetries=v;} public void setNextAttemptAt(Instant v){nextAttemptAt=v;} public void setLastHeartbeatAt(Instant v){lastHeartbeatAt=v;}
}
