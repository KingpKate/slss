package com.slss.domain;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.*;
@Entity @Table(name="scan_templates", uniqueConstraints=@UniqueConstraint(name="uk_scan_template_customer_model",columnNames={"customer_name","model"}))
public class ScanTemplate {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
 @Column(name="customer_name",nullable=false) private String customerName;
 @Column(nullable=false) private String model;
 private String description;
 @Column(nullable=false) private boolean active=true;
 @Column(name="created_by",nullable=false) private String createdBy;
 @Column(name="created_at",nullable=false) private Instant createdAt=Instant.now();
 @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="tenant_id") private CustomerTenant tenant;
 @OneToMany(mappedBy="template",cascade=CascadeType.ALL,orphanRemoval=true) private List<ScanTemplateField> fields=new ArrayList<>();
 public CustomerTenant getTenant(){return tenant;} public void setTenant(CustomerTenant v){tenant=v;}
 public Long getId(){return id;} public String getCustomerName(){return customerName;} public void setCustomerName(String v){customerName=v;} public String getModel(){return model;} public void setModel(String v){model=v;} public String getDescription(){return description;} public void setDescription(String v){description=v;} public boolean isActive(){return active;} public void setActive(boolean v){active=v;} public String getCreatedBy(){return createdBy;} public void setCreatedBy(String v){createdBy=v;} public Instant getCreatedAt(){return createdAt;} public List<ScanTemplateField> getFields(){return fields;}
}
