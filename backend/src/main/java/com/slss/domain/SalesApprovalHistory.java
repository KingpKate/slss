package com.slss.domain;
import jakarta.persistence.*; import java.time.Instant;
@Entity @Table(name="sales_approval_history") public class SalesApprovalHistory {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
 @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="initiation_id",nullable=false) private SalesInitiation initiation;
 @Enumerated(EnumType.STRING) @Column(name="from_status") private SalesInitiationStatus fromStatus;
 @Enumerated(EnumType.STRING) @Column(name="to_status",nullable=false) private SalesInitiationStatus toStatus;
 private String comment; @Column(name="operated_by",nullable=false) private String operatedBy;
 @Column(name="created_at",nullable=false) private Instant createdAt=Instant.now();
 public void setInitiation(SalesInitiation v){initiation=v;} public void setFromStatus(SalesInitiationStatus v){fromStatus=v;} public void setToStatus(SalesInitiationStatus v){toStatus=v;} public void setComment(String v){comment=v;} public void setOperatedBy(String v){operatedBy=v;}
}
