package com.slss.domain;
import jakarta.persistence.*; import java.time.LocalDate;
@Entity @Table(name="assets") public class Asset {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
 @Column(name="machine_sn",nullable=false,unique=true) private String machineSn;
 private String contractNo; private LocalDate invoiceDate; private String model;
 @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="batch_id") ProductionBatch batch; public Long getId(){return id;} public String getMachineSn(){return machineSn;} public void setMachineSn(String v){machineSn=v;} public String getContractNo(){return contractNo;} public void setContractNo(String v){contractNo=v;} public LocalDate getInvoiceDate(){return invoiceDate;} public void setInvoiceDate(LocalDate v){invoiceDate=v;} public String getModel(){return model;} public void setModel(String v){model=v;} public ProductionBatch getBatch(){return batch;} public void setBatch(ProductionBatch b){batch=b;}
 @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="tenant_id") CustomerTenant tenant; public CustomerTenant getTenant(){return tenant;} public void setTenant(CustomerTenant v){tenant=v;}
}
