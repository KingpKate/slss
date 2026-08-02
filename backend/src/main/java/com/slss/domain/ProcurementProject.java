package com.slss.domain;
import jakarta.persistence.*; import java.time.*;
@Entity @Table(name="procurement_projects") public class ProcurementProject {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
 @Column(name="project_no",nullable=false,unique=true) private String projectNo;
 @OneToOne(fetch=FetchType.LAZY) @JoinColumn(name="initiation_id",nullable=false) private SalesInitiation initiation;
 @Column(nullable=false) private String status="PENDING"; @Column(name="quotation_deadline") private LocalDate quotationDeadline;
 @Column(name="selected_supplier") private String selectedSupplier; @Column(name="created_at") private Instant createdAt=Instant.now();
 public Long getId(){return id;} public Long getInitiationId(){return initiation.getId();} public SalesInitiation getInitiation(){return initiation;} public String getProjectNo(){return projectNo;} public String getStatus(){return status;} public LocalDate getQuotationDeadline(){return quotationDeadline;} public String getSelectedSupplier(){return selectedSupplier;} public void setProjectNo(String v){projectNo=v;} public void setInitiation(SalesInitiation v){initiation=v;} public void setStatus(String v){status=v;} public void setQuotationDeadline(LocalDate v){quotationDeadline=v;} public void setSelectedSupplier(String v){selectedSupplier=v;}
}
