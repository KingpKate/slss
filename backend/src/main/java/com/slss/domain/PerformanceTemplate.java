package com.slss.domain;

import jakarta.persistence.*;
import java.time.*;
import java.util.*;

@Entity @Table(name="performance_templates")
public class PerformanceTemplate {
  @Id @GeneratedValue(strategy=GenerationType.IDENTITY) Long id;
  @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="tenant_id") CustomerTenant tenant;
  @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="department_id",nullable=false) PerformanceDepartment department;
  @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="subject_user_id") User subjectUser;
  @Column(name="template_name",nullable=false) String name;
  @Column(name="source_sheet",nullable=false) String sourceSheet;
  @Column(name="schema_version",nullable=false) String schemaVersion="1.0";
  @Column(name="template_version",nullable=false) int templateVersion=1;
  @Column(nullable=false) String status="ACTIVE";
  @Column(name="total_score",nullable=false) java.math.BigDecimal totalScore=java.math.BigDecimal.valueOf(100);
  @Version @Column(nullable=false) Long version=0L;
  @Column(name="created_at",nullable=false) Instant createdAt=Instant.now();
  @Column(name="published_at") Instant publishedAt;
  @Column(name="effective_from") LocalDate effectiveFrom;
  @Column(name="effective_to") LocalDate effectiveTo;
  @OneToMany(mappedBy="template",cascade=CascadeType.ALL,orphanRemoval=true) @OrderBy("sortOrder ASC") List<PerformanceSection> sections=new ArrayList<>();
  @OneToMany(mappedBy="template",cascade=CascadeType.ALL,orphanRemoval=true) @OrderBy("sortOrder ASC") List<PerformanceTemplateField> fields=new ArrayList<>();
  protected PerformanceTemplate() {}
  public PerformanceTemplate(PerformanceDepartment d,String n,String s){department=d;name=n;sourceSheet=s;}
  public Long getId(){return id;} public PerformanceDepartment getDepartment(){return department;} public User getSubjectUser(){return subjectUser;} public void setSubjectUser(User value){subjectUser=value;} public String getName(){return name;} public String getSourceSheet(){return sourceSheet;} public int getTemplateVersion(){return templateVersion;} public String getStatus(){return status;} public java.math.BigDecimal getTotalScore(){return totalScore;} public Long getVersion(){return version;} public Instant getPublishedAt(){return publishedAt;} public LocalDate getEffectiveFrom(){return effectiveFrom;} public LocalDate getEffectiveTo(){return effectiveTo;} public List<PerformanceSection> getSections(){return sections;} public List<PerformanceTemplateField> getFields(){return fields;} public void setName(String value){name=value;} public void setStatus(String value){status=value;} public void setTemplateVersion(int value){templateVersion=value;} public void setPublishedAt(Instant value){publishedAt=value;} public void setEffectiveFrom(LocalDate value){effectiveFrom=value;} public void setEffectiveTo(LocalDate value){effectiveTo=value;}
}
