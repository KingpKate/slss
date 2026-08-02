package com.slss.domain;

import jakarta.persistence.*;
import java.util.HashSet;
import java.util.Set;
import java.time.Instant;

/** Optional permission group. Existing roles remain the source of truth and
 * group permissions are additive for backwards compatibility. */
@Entity
@Table(name = "permission_groups")
public class PermissionGroup {
  @Id @GeneratedValue(strategy = GenerationType.IDENTITY) Long id;
  @Column(nullable = false, unique = true, length = 80) String code;
  @Column(nullable = false, length = 120) String name;
  @Column(length = 500) String description;
  @Column(nullable = false) boolean enabled = true;
  @Version @Column(nullable = false) Long version = 0L;
  @Column(name = "deleted_at") Instant deletedAt;
  @Column(name = "deleted_by", length = 100) String deletedBy;
  @Column(name = "updated_by", length = 100) String updatedBy;
  @ManyToMany(fetch = FetchType.EAGER)
  @JoinTable(name = "permission_group_permissions",
      joinColumns = @JoinColumn(name = "group_id"),
      inverseJoinColumns = @JoinColumn(name = "permission_id"))
  Set<Permission> permissions = new HashSet<>();
  protected PermissionGroup() {}
  public PermissionGroup(String code, String name) { this.code = code; this.name = name; }
  public Long getId() { return id; }
  public String getCode() { return code; }
  public String getName() { return name; }
  public void setName(String name) { this.name = name; }
  public String getDescription() { return description; }
  public void setDescription(String description) { this.description = description; }
  public boolean isEnabled() { return enabled; }
  public void setEnabled(boolean enabled) { this.enabled = enabled; }
  public Long getVersion() { return version; }
  public Instant getDeletedAt() { return deletedAt; }
  public void setDeletedAt(Instant deletedAt) { this.deletedAt = deletedAt; }
  public String getDeletedBy() { return deletedBy; }
  public void setDeletedBy(String deletedBy) { this.deletedBy = deletedBy; }
  public String getUpdatedBy() { return updatedBy; }
  public void setUpdatedBy(String updatedBy) { this.updatedBy = updatedBy; }
  public Set<Permission> getPermissions() { return permissions; }
}
