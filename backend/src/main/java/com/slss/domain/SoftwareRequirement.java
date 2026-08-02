package com.slss.domain;
import jakarta.persistence.*;
@Entity @Table(name="sales_software_requirements") public class SoftwareRequirement {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
 @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="initiation_id",nullable=false) private SalesInitiation initiation;
 @Column(name="os_name") private String osName; @Column(name="os_version") private String osVersion;
 @Column(columnDefinition="TEXT") private String middleware; @Column(name="database_requirement",columnDefinition="TEXT") private String databaseRequirement;
 @Column(name="license_requirement",columnDefinition="TEXT") private String licenseRequirement; @Column(name="security_requirement",columnDefinition="TEXT") private String securityRequirement;
 public Long getId(){return id;} public Long getInitiationId(){return initiation.getId();} public String getOsName(){return osName;} public String getOsVersion(){return osVersion;} public String getMiddleware(){return middleware;} public String getDatabaseRequirement(){return databaseRequirement;} public String getLicenseRequirement(){return licenseRequirement;} public String getSecurityRequirement(){return securityRequirement;} public void setInitiation(SalesInitiation v){initiation=v;} public void setOsName(String v){osName=v;} public void setOsVersion(String v){osVersion=v;} public void setMiddleware(String v){middleware=v;} public void setDatabaseRequirement(String v){databaseRequirement=v;} public void setLicenseRequirement(String v){licenseRequirement=v;} public void setSecurityRequirement(String v){securityRequirement=v;}
}
