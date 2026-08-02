package com.slss.domain;
import jakarta.persistence.*; import java.time.Instant;
@Entity @Table(name="customer_tenants") public class CustomerTenant {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
 @Column(name="tenant_code",nullable=false,unique=true) private String tenantCode;
 @Column(name="tenant_name",nullable=false) private String tenantName;
 @Column(nullable=false) private String status="ACTIVE"; @Column(name="created_at") private Instant createdAt=Instant.now();
 public Long getId(){return id;} public String getTenantCode(){return tenantCode;} public String getTenantName(){return tenantName;} public String getStatus(){return status;} public void setTenantCode(String v){tenantCode=v;} public void setTenantName(String v){tenantName=v;} public void setStatus(String v){status=v;}
}
