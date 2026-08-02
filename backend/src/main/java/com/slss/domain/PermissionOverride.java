package com.slss.domain;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name="permission_overrides", uniqueConstraints=@UniqueConstraint(name="uq_permission_override_user_code", columnNames={"user_id","permission_code"}))
public class PermissionOverride {
  @Id @GeneratedValue(strategy=GenerationType.IDENTITY) Long id;
  @Column(name="user_id", nullable=false) Long userId;
  @Column(name="permission_code", nullable=false, length=100) String permissionCode;
  @Column(nullable=false, length=10) String effect;
  @Column(name="created_by", nullable=false, length=100) String createdBy;
  @Column(name="updated_at", nullable=false) Instant updatedAt=Instant.now();
  protected PermissionOverride() {}
  public PermissionOverride(Long userId,String permissionCode,String effect,String createdBy){this.userId=userId;this.permissionCode=permissionCode;this.effect=effect;this.createdBy=createdBy;}
  public Long getId(){return id;} public Long getUserId(){return userId;} public String getPermissionCode(){return permissionCode;} public String getEffect(){return effect;} public void setEffect(String v){effect=v;} public String getCreatedBy(){return createdBy;} public void setCreatedBy(String v){createdBy=v;} public Instant getUpdatedAt(){return updatedAt;}
}
