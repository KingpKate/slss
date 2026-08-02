package com.slss.domain;

import jakarta.persistence.*;
import java.time.Instant;

@Entity @Table(name="permission_change_requests")
public class PermissionChangeRequest {
  @Id @GeneratedValue(strategy=GenerationType.IDENTITY) Long id;
  @Column(name="target_type",nullable=false,length=30) String targetType;
  @Column(name="target_id",nullable=false) Long targetId;
  @Column(name="change_type",nullable=false,length=40) String changeType;
  @Column(name="payload_json",nullable=false,columnDefinition="TEXT") String payloadJson;
  @Column(nullable=false,length=20) String status="PENDING";
  @Column(name="requested_by",nullable=false,length=100) String requestedBy;
  @Column(name="reviewed_by",length=100) String reviewedBy;
  @Column(name="review_comment",length=500) String reviewComment;
  @Column(name="requested_at",nullable=false) Instant requestedAt=Instant.now();
  @Column(name="reviewed_at") Instant reviewedAt;
  @Version @Column(nullable=false) Long version=0L;
  protected PermissionChangeRequest() {}
  public PermissionChangeRequest(String targetType,Long targetId,String changeType,String payloadJson,String requestedBy){this.targetType=targetType;this.targetId=targetId;this.changeType=changeType;this.payloadJson=payloadJson;this.requestedBy=requestedBy;}
  public Long getId(){return id;} public String getTargetType(){return targetType;} public Long getTargetId(){return targetId;} public String getChangeType(){return changeType;} public String getPayloadJson(){return payloadJson;} public String getStatus(){return status;} public void setStatus(String v){status=v;} public String getRequestedBy(){return requestedBy;} public String getReviewedBy(){return reviewedBy;} public void setReviewedBy(String v){reviewedBy=v;} public String getReviewComment(){return reviewComment;} public void setReviewComment(String v){reviewComment=v;} public Instant getRequestedAt(){return requestedAt;} public Instant getReviewedAt(){return reviewedAt;} public void setReviewedAt(Instant v){reviewedAt=v;} public Long getVersion(){return version;}
}
