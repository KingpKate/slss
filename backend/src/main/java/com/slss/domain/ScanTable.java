package com.slss.domain;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.*;
@Entity @Table(name="scan_tables")
public class ScanTable {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
 @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="template_id",nullable=false) private ScanTemplate template;
 @Column(name="customer_name",nullable=false) private String customerName;
 @Column(nullable=false) private String model;
 @Column(name="dispatch_order_no") private String dispatchOrderNo;
 @Column(name="disable_auto_fill_part_models",nullable=false) private boolean disableAutoFillPartModels;
 @Column(name="hidden_field_keys",columnDefinition="TEXT") private String hiddenFieldKeys;
 @Column(name="custom_field_defs",columnDefinition="TEXT") private String customFieldDefs;
 @Column(nullable=false) private int quantity;
 @Column(nullable=false) private String status="OPEN";
 @Column(name="created_by",nullable=false) private String createdBy;
 @Column(name="created_at",nullable=false) private Instant createdAt=Instant.now();
 @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="tenant_id") private CustomerTenant tenant;
 @OneToMany(mappedBy="scanTable",cascade=CascadeType.ALL,orphanRemoval=true) private List<ScanTableRow> rows=new ArrayList<>();
 public CustomerTenant getTenant(){return tenant;} public void setTenant(CustomerTenant v){tenant=v;}
 public Long getId(){return id;} public ScanTemplate getTemplate(){return template;} public void setTemplate(ScanTemplate v){template=v;} public String getCustomerName(){return customerName;} public void setCustomerName(String v){customerName=v;} public String getModel(){return model;} public void setModel(String v){model=v;} public String getDispatchOrderNo(){return dispatchOrderNo;} public void setDispatchOrderNo(String v){dispatchOrderNo=v;} public boolean isDisableAutoFillPartModels(){return disableAutoFillPartModels;} public void setDisableAutoFillPartModels(boolean v){disableAutoFillPartModels=v;} public String getHiddenFieldKeys(){return hiddenFieldKeys;} public void setHiddenFieldKeys(String v){hiddenFieldKeys=v;} public String getCustomFieldDefs(){return customFieldDefs;} public void setCustomFieldDefs(String v){customFieldDefs=v;} public int getQuantity(){return quantity;} public void setQuantity(int v){quantity=v;} public String getStatus(){return status;} public void setStatus(String v){status=v;} public String getCreatedBy(){return createdBy;} public void setCreatedBy(String v){createdBy=v;} public Instant getCreatedAt(){return createdAt;} public List<ScanTableRow> getRows(){return rows;}
}
