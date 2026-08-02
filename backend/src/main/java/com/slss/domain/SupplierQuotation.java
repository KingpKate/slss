package com.slss.domain;
import jakarta.persistence.*; import java.math.BigDecimal; import java.time.*;
@Entity @Table(name="supplier_quotations") public class SupplierQuotation {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
 @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="procurement_project_id",nullable=false) private ProcurementProject project;
 @Column(name="supplier_name",nullable=false) private String supplierName; @Column(nullable=false,precision=18,scale=2) private BigDecimal amount;
 @Column(nullable=false) private String currency="CNY"; @Column(name="delivery_date") private LocalDate deliveryDate; @Column(name="validity_date") private LocalDate validityDate;
 @Column(columnDefinition="TEXT") private String notes; @Column(nullable=false) private String status="SUBMITTED"; @Column(name="created_at") private Instant createdAt=Instant.now();
 public Long getId(){return id;} public Long getProjectId(){return project.getId();} public String getSupplierName(){return supplierName;} public BigDecimal getAmount(){return amount;} public String getCurrency(){return currency;} public LocalDate getDeliveryDate(){return deliveryDate;} public LocalDate getValidityDate(){return validityDate;} public String getNotes(){return notes;} public String getStatus(){return status;} public Instant getCreatedAt(){return createdAt;} public void setProject(ProcurementProject v){project=v;} public void setSupplierName(String v){supplierName=v;} public void setAmount(BigDecimal v){amount=v;} public void setCurrency(String v){currency=v;} public void setDeliveryDate(LocalDate v){deliveryDate=v;} public void setValidityDate(LocalDate v){validityDate=v;} public void setNotes(String v){notes=v;} public void setStatus(String v){status=v;}
}
