package com.slss.domain;
import jakarta.persistence.*; import java.time.*;
@Entity @Table(name="sales_initiations")
public class SalesInitiation {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
 @Column(name="initiation_no",nullable=false,unique=true) private String initiationNo;
 @Column(name="customer_name",nullable=false) private String customerName;
 @Column(name="project_name",nullable=false) private String projectName;
 @Column(name="sales_owner") private Long salesOwner;
 @Column(nullable=false) private int quantity;
 @Column(name="requested_delivery_date") private LocalDate requestedDeliveryDate;
 @Column(name="delivery_location") private String deliveryLocation;
 private String priority;
 @Enumerated(EnumType.STRING) @Column(nullable=false) private SalesInitiationStatus status=SalesInitiationStatus.DRAFT;
 @Column(name="business_background",columnDefinition="TEXT") private String businessBackground;
 @Column(name="technical_summary",columnDefinition="TEXT") private String technicalSummary;
 @Column(name="software_summary",columnDefinition="TEXT") private String softwareSummary;
 @Column(name="created_at",nullable=false) private Instant createdAt=Instant.now();
 @Column(name="updated_at",nullable=false) private Instant updatedAt=Instant.now();
 @PreUpdate void touch(){updatedAt=Instant.now();}
 public Long getId(){return id;} public String getInitiationNo(){return initiationNo;} public void setInitiationNo(String v){initiationNo=v;} public String getCustomerName(){return customerName;} public void setCustomerName(String v){customerName=v;} public String getProjectName(){return projectName;} public void setProjectName(String v){projectName=v;} public Long getSalesOwner(){return salesOwner;} public void setSalesOwner(Long v){salesOwner=v;} public int getQuantity(){return quantity;} public void setQuantity(int v){quantity=v;} public LocalDate getRequestedDeliveryDate(){return requestedDeliveryDate;} public void setRequestedDeliveryDate(LocalDate v){requestedDeliveryDate=v;} public String getDeliveryLocation(){return deliveryLocation;} public void setDeliveryLocation(String v){deliveryLocation=v;} public String getPriority(){return priority;} public void setPriority(String v){priority=v;} public SalesInitiationStatus getStatus(){return status;} public void setStatus(SalesInitiationStatus v){status=v;} public String getBusinessBackground(){return businessBackground;} public void setBusinessBackground(String v){businessBackground=v;} public String getTechnicalSummary(){return technicalSummary;} public void setTechnicalSummary(String v){technicalSummary=v;} public String getSoftwareSummary(){return softwareSummary;} public void setSoftwareSummary(String v){softwareSummary=v;} public Instant getCreatedAt(){return createdAt;} public Instant getUpdatedAt(){return updatedAt;}
}
