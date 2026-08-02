package com.slss.domain;

import jakarta.persistence.*;

@Entity @Table(name="permission_cache_versions")
public class PermissionCacheVersion {
  @Id Long id;
  @Column(nullable=false) Long version=0L;
  protected PermissionCacheVersion() {}
  public PermissionCacheVersion(Long id){this.id=id;}
  public Long getId(){return id;} public Long getVersion(){return version;} public void bump(){version++;}
}
