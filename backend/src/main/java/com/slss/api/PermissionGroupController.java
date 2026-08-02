package com.slss.api;

import com.slss.domain.*;
import com.slss.repository.*;
import com.slss.service.AuditService;
import com.slss.service.PermissionCacheService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.security.Principal;
import java.util.List;
import java.util.Set;
import java.util.HashSet;
import java.time.Instant;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/v1/permission-groups")
@PreAuthorize("hasAuthority('PERM_MANAGE_SYSTEM')")
public class PermissionGroupController {
  private final PermissionGroupRepository groups; private final PermissionRepository permissions;
  private final UserRepository users; private final AuditService audit; private final PermissionCacheService permissionCache;
  public PermissionGroupController(PermissionGroupRepository g, PermissionRepository p, UserRepository u, AuditService a, PermissionCacheService c) { groups=g; permissions=p; users=u; audit=a; permissionCache=c; }
  // The same payload is used by profile, permission and member endpoints;
  // only the profile endpoints require a name. Keeping validation at the
  // endpoint boundary avoids rejecting a permissions-only update.
  public record GroupRequest(String code, String name, String description, Boolean enabled, Long version, List<String> permissions, List<Long> userIds) {}
  public record GroupAggregateRequest(String name, String description, Boolean enabled, Long version, List<String> permissions, List<Long> userIds) {}
  public record GroupResponse(Long id, String code, String name, String description, boolean enabled, Long version, List<Long> userIds, List<String> permissions) {}
  public record UserGroupsRequest(List<Long> groupIds, List<Long> userIds, Long version) { List<Long> ids(){ return userIds!=null?userIds:(groupIds==null?List.of():groupIds); } }
  private GroupResponse view(PermissionGroup g) { var memberIds=users.findAllByGroups_Id(g.getId()).stream().map(User::getId).toList(); return new GroupResponse(g.getId(),g.getCode(),g.getName(),g.getDescription(),g.isEnabled(),g.getVersion(),memberIds,g.getPermissions().stream().map(Permission::getCode).sorted().toList()); }

  @GetMapping @Transactional(readOnly = true)
  public List<GroupResponse> list() { return groups.findAllByDeletedAtIsNullOrderByNameAsc().stream().map(this::view).toList(); }

  @PostMapping @Transactional
  public GroupResponse create(@Valid @RequestBody GroupRequest r, Principal actor, HttpServletRequest req) {
    if (r.name() == null || r.name().isBlank()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"权限组名称不能为空");
    String code=(r.code()==null||r.code().isBlank()?"GROUP_"+System.currentTimeMillis():r.code().trim());
    if (groups.findByCodeAndDeletedAtIsNull(code).isPresent()) throw new ResponseStatusException(HttpStatus.CONFLICT,"权限组编码已存在");
    var g = new PermissionGroup(code,r.name().trim()); g.setDescription(r.description()); apply(g,r); var saved=groups.saveAndFlush(g); permissionCache.bump();
    audit.record(actor.getName(),"PERMISSION_GROUP_CREATE","PERMISSION_GROUP",String.valueOf(saved.getId()),saved.getCode(),req.getRemoteAddr(),true); return view(saved);
  }

  @PutMapping("/{id}") @Transactional
  public GroupResponse update(@PathVariable Long id,@Valid @RequestBody GroupRequest r,Principal actor,HttpServletRequest req) {
    if (r.name() == null || r.name().isBlank()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"权限组名称不能为空");
    var g=groups.findByIdAndDeletedAtIsNull(id).orElseThrow(); checkVersion(g,r.version());
    ensureGroupAdminSafety(g, r.enabled()==null || r.enabled(), r.permissions()==null ? permissionCodes(g) : r.permissions(), memberIds(g));
    g.setName(r.name().trim()); g.setDescription(r.description()); g.setEnabled(r.enabled()==null||r.enabled()); g.setUpdatedBy(actor.getName());
    // A profile edit must not silently clear permissions when the client only
    // submits name/description. Permission replacement is explicit via
    // /{id}/permissions (or by including permissions in this request).
    if (r.permissions() != null) apply(g,r);
    audit.record(actor.getName(),"PERMISSION_GROUP_UPDATE","PERMISSION_GROUP",String.valueOf(id),g.getCode(),req.getRemoteAddr(),true); var saved=groups.saveAndFlush(g); permissionCache.bump(); return view(saved);
  }

  @DeleteMapping("/{id}") @Transactional
  public void delete(@PathVariable Long id,Principal actor,HttpServletRequest req) { var g=groups.findByIdAndDeletedAtIsNull(id).orElseThrow(); ensureGroupAdminSafety(g,false,List.of(),Set.of()); g.setEnabled(false); g.setDeletedAt(Instant.now()); g.setDeletedBy(actor.getName()); g.setUpdatedBy(actor.getName()); groups.save(g); permissionCache.bump(); audit.record(actor.getName(),"PERMISSION_GROUP_DELETE","PERMISSION_GROUP",String.valueOf(id),g.getCode(),req.getRemoteAddr(),true); }

  @PutMapping("/users/{userId}") @Transactional
  public List<GroupResponse> assign(@PathVariable Long userId,@RequestBody UserGroupsRequest r,Principal actor,HttpServletRequest req) {
    var u=users.findById(userId).orElseThrow(); var ids=r.ids();
    if (ids.stream().anyMatch(java.util.Objects::isNull) || ids.stream().distinct().count()!=ids.size())
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"权限组列表包含重复或无效 ID");
    u.getGroups().clear(); for(Long id:ids) u.getGroups().add(groups.findByIdAndDeletedAtIsNull(id).orElseThrow()); users.save(u);
    audit.record(actor.getName(),"USER_PERMISSION_GROUPS","USER",String.valueOf(userId),ids.toString(),req.getRemoteAddr(),true);
    permissionCache.bump();
    return u.getGroups().stream().map(this::view).toList();
  }
  /** Atomically updates profile, permissions and membership as one optimistic-lock transaction. */
  @PutMapping("/{id}/aggregate") @Transactional
  public GroupResponse aggregate(@PathVariable Long id,@RequestBody GroupAggregateRequest r,Principal actor,HttpServletRequest req) {
    var g=groups.findByIdAndDeletedAtIsNull(id).orElseThrow(); checkVersion(g,r.version());
    if (r.name()==null || r.name().isBlank()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"权限组名称不能为空");
    var ids=r.userIds()==null?List.<Long>of():r.userIds();
    if(ids.stream().anyMatch(java.util.Objects::isNull)||ids.stream().distinct().count()!=ids.size()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"成员列表包含重复或无效 ID");
    var permissionCodes = r.permissions()==null ? permissionCodes(g) : new HashSet<>(r.permissions());
    ensureGroupAdminSafety(g,r.enabled()==null||r.enabled(),permissionCodes,new HashSet<>(ids));
    g.setName(r.name().trim()); g.setDescription(r.description()); g.setEnabled(r.enabled()==null||r.enabled()); apply(g,new GroupRequest(null,g.getName(),g.getDescription(),g.isEnabled(),r.version(),r.permissions(),ids));
    var affected=new java.util.HashSet<>(users.findAllByGroups_Id(id)); if(!ids.isEmpty()) affected.addAll(users.findAllById(ids));
    affected.forEach(u->{u.getGroups().removeIf(x->x.getId().equals(id)); if(ids.contains(u.getId()))u.getGroups().add(g);}); users.saveAll(affected);
    g.setUpdatedBy(actor.getName()); var saved=groups.saveAndFlush(g); permissionCache.bump();
    audit.record(actor.getName(),"PERMISSION_GROUP_AGGREGATE_UPDATE","PERMISSION_GROUP",String.valueOf(id),"profile+permissions+members",req.getRemoteAddr(),true);
    return view(saved);
  }
  @GetMapping("/users/{userId}") @Transactional(readOnly=true)
  public List<GroupResponse> userGroups(@PathVariable Long userId) { return users.findById(userId).orElseThrow().getGroups().stream().filter(x->x.getDeletedAt()==null).map(this::view).toList(); }

  private void checkVersion(PermissionGroup g, Long requested) { if (requested != null && !requested.equals(g.getVersion())) throw new ResponseStatusException(HttpStatus.CONFLICT,"权限组已被其他管理员修改，请刷新后再保存"); }

  private Set<Long> memberIds(PermissionGroup g) { return users.findAllByGroups_Id(g.getId()).stream().map(User::getId).collect(java.util.stream.Collectors.toSet()); }
  private Set<String> permissionCodes(PermissionGroup g) { return g.getPermissions().stream().map(Permission::getCode).collect(java.util.stream.Collectors.toSet()); }
  private boolean hasSystemRole(User u) { return u.getRoles().stream().anyMatch(role -> role.getPermissions().stream().anyMatch(p -> "MANAGE_SYSTEM".equals(p.getCode()))); }
  private boolean hasSystemOutsideGroup(User u, Long groupId) { return hasSystemRole(u) || u.getGroups().stream().filter(x -> !x.getId().equals(groupId) && x.isEnabled() && x.getDeletedAt() == null).anyMatch(x -> x.getPermissions().stream().anyMatch(p -> "MANAGE_SYSTEM".equals(p.getCode()))); }
  private void ensureGroupAdminSafety(PermissionGroup g, boolean futureEnabled, java.util.Collection<String> futurePermissions, Set<Long> futureMembers) {
    if (!g.isEnabled() || g.getDeletedAt() != null || !g.getPermissions().stream().anyMatch(p -> "MANAGE_SYSTEM".equals(p.getCode()))) return;
    boolean futureGroupAdmin = futureEnabled && futurePermissions.stream().map(code -> code.startsWith("PERM_") ? code.substring(5) : code).anyMatch("MANAGE_SYSTEM"::equals);
    long current = users.findAll().stream().filter(u -> "ACTIVE".equals(u.getStatus()) && (hasSystemOutsideGroup(u,g.getId()) || memberIds(g).contains(u.getId()))).count();
    if (current == 0) return;
    long future = users.findAll().stream().filter(u -> "ACTIVE".equals(u.getStatus()) && (hasSystemOutsideGroup(u,g.getId()) || (futureGroupAdmin && futureMembers.contains(u.getId())))).count();
    if (future == 0) throw new ResponseStatusException(HttpStatus.CONFLICT,"不能移除系统中最后一个管理员权限");
  }

  private void apply(PermissionGroup g, GroupRequest r) { g.getPermissions().clear(); for(String raw:r.permissions()==null?List.<String>of():r.permissions()){String code=raw.startsWith("PERM_")?raw.substring(5):raw; g.getPermissions().add(permissions.findByCode(code).orElseThrow(()->new ResponseStatusException(HttpStatus.BAD_REQUEST,"权限不存在: "+raw)));} }
}
