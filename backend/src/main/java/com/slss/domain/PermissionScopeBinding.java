package com.slss.domain;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name="permission_scope_bindings")
public class PermissionScopeBinding {
  @Id @GeneratedValue(strategy=GenerationType.IDENTITY) Long id;
  @Column(name="subject_type",nullable=false,length=20) String subjectType;
  @Column(name="subject_id",nullable=false) Long subjectId;
  @Column(name="permission_code",nullable=false,length=100) String permissionCode;
  @Column(name="scope_type",nullable=false,length=30) String scopeType;
  @Column(name="scope_value",length=160) String scopeValue;
  @Version @Column(nullable=false) Long version=0L;
  @Column(name="updated_by",length=100) String updatedBy;
  @Column(name="updated_at",nullable=false) Instant updatedAt=Instant.now();
  protected PermissionScopeBinding() {}
  public PermissionScopeBinding(String subjectType,Long subjectId,String permissionCode,String scopeType,String scopeValue){this.subjectType=subjectType;this.subjectId=subjectId;this.permissionCode=permissionCode;this.scopeType=scopeType;this.scopeValue=scopeValue;}
  public Long getId(){return id;} public String getSubjectType(){return subjectType;} public Long getSubjectId(){return subjectId;} public String getPermissionCode(){return permissionCode;} public String getScopeType(){return scopeType;} public String getScopeValue(){return scopeValue;} public Long getVersion(){return version;} public void setUpdatedBy(String v){updatedBy=v;}
}
