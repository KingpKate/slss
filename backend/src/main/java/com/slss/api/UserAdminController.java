package com.slss.api;

import com.slss.domain.User;
import com.slss.repository.*;
import com.slss.service.AuditService;
import com.slss.service.PermissionCacheService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.security.Principal;
import java.util.List;
import java.util.Map;
import java.util.LinkedHashMap;
import java.util.ArrayList;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/v1")
public class UserAdminController {
  private final UserRepository users;
  private final RoleRepository roles;
  private final PermissionRepository permissions;
  private final AuditLogRepository auditLogs;
  private final PasswordEncoder encoder;
  private final AuditService audit;
  private final RefreshTokenRepository refreshTokens;
  private final PermissionCacheService permissionCache;
  public UserAdminController(UserRepository u,RoleRepository r,PermissionRepository p,AuditLogRepository logs,PasswordEncoder e,AuditService a,RefreshTokenRepository tokens,PermissionCacheService cache){users=u;roles=r;permissions=p;auditLogs=logs;encoder=e;audit=a;refreshTokens=tokens;permissionCache=cache;}

  public record UserResponse(Long id,String username,String status,boolean mustChangePassword,int failedLoginAttempts,List<String> roles,List<String> permissions,List<String> personalPermissions,List<Long> permissionGroupIds,Map<String,List<String>> permissionSources){}
  public record CreateUserRequest(@Size(min=3,max=100,message="用户名至少需要 3 个字符") String username,@Size(min=8,max=100) String password,@NotEmpty List<String> roles){}
  public record UpdateUserRequest(@Size(min=3,max=100) String username,String password,@NotEmpty List<String> roles){}
  public record StatusRequest(@Pattern(regexp="ACTIVE|DISABLED") String status){}
  public record ResetPasswordRequest(@Size(min=8,max=100) String newPassword){}
  public record ChangePasswordRequest(@NotBlank String currentPassword,@Size(min=8,max=100) String newPassword){}
  public record PermissionsRequest(List<String> permissions){}
  private UserResponse response(User u){
    var evaluated = permissionCache.evaluate(u.getUsername());
    var effective = evaluated.allowed().stream().sorted().toList();
    var personal = u.getRoles().stream().filter(x -> x.getCode().startsWith("USER_"+u.getId()+"_CUSTOM"))
      .flatMap(x -> x.getPermissions().stream()).map(p -> p.getCode()).distinct().sorted().toList();
    var roleNames = java.util.stream.Stream.concat(u.getRoles().stream().filter(x->!x.getCode().startsWith("USER_"+u.getId()+"_CUSTOM")).map(x->x.getCode()), u.getGroups().stream().map(x->"GROUP_"+x.getCode())).sorted().toList();
    var sources = new LinkedHashMap<String,List<String>>(evaluated.sources());
    return new UserResponse(u.getId(),u.getUsername(),u.getStatus(),u.isMustChangePassword(),u.getFailedLoginAttempts(),roleNames,effective,personal,u.getGroups().stream().map(com.slss.domain.PermissionGroup::getId).toList(),sources);
  }

  @GetMapping("/users") @PreAuthorize("hasAuthority('PERM_MANAGE_SYSTEM')")
  public List<UserResponse> list(){return users.findAll().stream().map(this::response).toList();}

  @PostMapping("/users") @PreAuthorize("hasAuthority('PERM_MANAGE_SYSTEM')") @Transactional
  public UserResponse create(@Valid @RequestBody CreateUserRequest r,Principal principal,HttpServletRequest request){
    if(users.findByUsernameAndStatus(r.username(),"ACTIVE").isPresent())throw new ResponseStatusException(HttpStatus.CONFLICT,"用户名已存在");
    var user=new User(r.username(),encoder.encode(r.password()));user.setMustChangePassword(false);
    for(var code:r.roles())user.getRoles().add(roles.findByCode(code).orElseThrow(()->new ResponseStatusException(HttpStatus.BAD_REQUEST,"角色不存在: "+code)));
    var saved=users.save(user); permissionCache.bump(); audit.record(principal.getName(),"USER_CREATE","USER",String.valueOf(saved.getId()),saved.getUsername(),request.getRemoteAddr(),true);return response(saved);
  }
  @PutMapping("/users/{id}") @PreAuthorize("hasAuthority('PERM_MANAGE_SYSTEM')") @Transactional
  public UserResponse update(@PathVariable Long id,@Valid @RequestBody UpdateUserRequest r,Principal principal,HttpServletRequest request){
    var user=users.findById(id).orElseThrow();
    var wasSystemAdmin = hasSystemPermission(user);
    if(!user.getUsername().equals(r.username()) && users.findByUsernameAndStatus(r.username(),"ACTIVE").isPresent()) throw new ResponseStatusException(HttpStatus.CONFLICT,"用户名已存在");
    user.setUsername(r.username().trim());
    // Keep the stable per-user custom role when editing the profile.  Replacing
    // the complete role collection used to silently erase personal grants that
    // had been saved through /users/{id}/permissions.
    var customRoleCode = "USER_" + id + "_CUSTOM";
    var customRole = user.getRoles().stream()
        .filter(existing -> existing.getCode().equals(customRoleCode))
        .findFirst().orElse(null);
    var updatedRoles = new java.util.HashSet<com.slss.domain.Role>();
    if (customRole != null) updatedRoles.add(customRole);
    for(var code:r.roles()) {
      var role = roles.findByCode(code).orElseThrow(() ->
          new ResponseStatusException(HttpStatus.BAD_REQUEST,"角色不存在: "+code));
      updatedRoles.add(role);
    }
    user.setRoles(updatedRoles);
    if (wasSystemAdmin && !hasSystemPermission(user) && countOtherSystemAdmins(id) == 0) throw new ResponseStatusException(HttpStatus.CONFLICT,"不能移除系统中最后一个管理员权限");
    if(r.password()!=null&&!r.password().isBlank()){if(r.password().length()<8)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"密码至少 8 位");user.setPasswordHash(encoder.encode(r.password()));user.setMustChangePassword(false);}
    audit.record(principal.getName(),"USER_UPDATE","USER",String.valueOf(id),user.getUsername(),request.getRemoteAddr(),true);
    var saved=users.save(user); permissionCache.bump(); return response(saved);
  }
  @DeleteMapping("/users/{id}") @PreAuthorize("hasAuthority('PERM_MANAGE_SYSTEM')") @Transactional
  public void delete(@PathVariable Long id,Principal principal,HttpServletRequest request){
    var user=users.findById(id).orElseThrow();
    if(user.getUsername().equals(principal.getName())) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"不能删除当前登录账号");
    if(hasSystemPermission(user) && countOtherSystemAdmins(id) == 0) throw new ResponseStatusException(HttpStatus.CONFLICT,"不能删除系统中最后一个管理员账号");
    refreshTokens.findByUsernameOrderByCreatedAtDesc(user.getUsername()).forEach(token->{token.setRevokedAt(java.time.Instant.now());refreshTokens.save(token);});
    users.delete(user); permissionCache.bump();
    audit.record(principal.getName(),"USER_DELETE","USER",String.valueOf(id),user.getUsername(),request.getRemoteAddr(),true);
  }

  @PutMapping("/users/{id}/status") @PreAuthorize("hasAuthority('PERM_MANAGE_SYSTEM')") @Transactional
  public UserResponse status(@PathVariable Long id,@Valid @RequestBody StatusRequest r,Principal principal,HttpServletRequest request){var user=users.findById(id).orElseThrow();if("DISABLED".equals(r.status())&&hasSystemPermission(user)&&countOtherSystemAdmins(id)==0)throw new ResponseStatusException(HttpStatus.CONFLICT,"不能禁用系统中最后一个管理员账号");user.setStatus(r.status());audit.record(principal.getName(),"USER_STATUS","USER",String.valueOf(id),r.status(),request.getRemoteAddr(),true);var saved=users.save(user);permissionCache.bump();return response(saved);}

  @PutMapping("/users/{id}/password") @PreAuthorize("hasAuthority('PERM_MANAGE_SYSTEM')") @Transactional
  public void reset(@PathVariable Long id,@Valid @RequestBody ResetPasswordRequest r,Principal principal,HttpServletRequest request){var user=users.findById(id).orElseThrow();user.setPasswordHash(encoder.encode(r.newPassword()));user.setMustChangePassword(false);user.setFailedLoginAttempts(0);user.setLockedUntil(null);users.save(user);audit.record(principal.getName(),"PASSWORD_RESET","USER",String.valueOf(id),null,request.getRemoteAddr(),true);}

  @PutMapping("/me/password") @Transactional
  public void change(@Valid @RequestBody ChangePasswordRequest r,Principal principal,HttpServletRequest request){var user=users.findByUsernameAndStatus(principal.getName(),"ACTIVE").orElseThrow();if(!encoder.matches(r.currentPassword(),user.getPasswordHash()))throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,"当前密码错误");if(encoder.matches(r.newPassword(),user.getPasswordHash()))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"新密码不能与当前密码相同");user.setPasswordHash(encoder.encode(r.newPassword()));user.setMustChangePassword(false);users.save(user);audit.record(principal.getName(),"PASSWORD_CHANGE","USER",String.valueOf(user.getId()),null,request.getRemoteAddr(),true);}

  @PutMapping("/users/{id}/permissions") @PreAuthorize("hasAuthority('PERM_MANAGE_SYSTEM')") @Transactional
  public UserResponse permissions(@PathVariable Long id,@RequestBody PermissionsRequest r,Principal principal,HttpServletRequest request){
    var user=users.findById(id).orElseThrow();
    var wasSystemAdmin = hasSystemPermission(user);
    // One stable custom role per user. Reusing it prevents a new orphan role on every save.
    var role=roles.findByCode("USER_"+id+"_CUSTOM").orElseGet(() -> new com.slss.domain.Role("USER_"+id+"_CUSTOM"));
    role.getPermissions().clear();
    for(var code:(r.permissions()==null?List.<String>of():r.permissions())){
      var normalized=code.startsWith("PERM_")?code.substring(5):code;
      role.getPermissions().add(permissions.findByCode(normalized).orElseThrow(()->new ResponseStatusException(HttpStatus.BAD_REQUEST,"权限不存在: "+code)));
    }
    role=roles.save(role); user.getRoles().removeIf(existing -> existing.getCode().equals("USER_"+id+"_CUSTOM")); user.getRoles().add(role);
    if (wasSystemAdmin && !hasSystemPermission(user) && countOtherSystemAdmins(id) == 0) throw new ResponseStatusException(HttpStatus.CONFLICT,"不能移除系统中最后一个管理员权限");
    users.save(user); permissionCache.bump();
    // Keep independent device sessions active. Permissions are picked up by
    // /auth/me immediately and by normal refresh-token rotation for API
    // authorization. Administrators can still explicitly revoke one device
    // or all sessions through SessionController when required.
    audit.record(principal.getName(),"USER_PERMISSIONS","USER",String.valueOf(id),String.join(",",r.permissions()==null?List.of():r.permissions()),request.getRemoteAddr(),true); return response(user);
  }

  @GetMapping("/audit-logs") @PreAuthorize("hasAuthority('PERM_MANAGE_SYSTEM')")
  public Page<AuditLogResponse> auditLogs(@RequestParam(defaultValue="") String action,Pageable pageable){var page=action.isBlank()?auditLogs.findAll(pageable):auditLogs.findByActionContainingIgnoreCase(action,pageable);return page.map(x -> new AuditLogResponse(x.getId(),x.getActor(),x.getAction(),x.getTargetType(),x.getTargetId(),x.getDetails(),x.getIpAddress(),x.isSuccess(),x.getCreatedAt()));}
  public record AuditLogResponse(Long id,String actor,String action,String targetType,String targetId,String details,String ipAddress,boolean success,java.time.Instant createdAt){}

  private boolean hasSystemPermission(User user) {
    return user.getRoles().stream().anyMatch(role -> role.getPermissions().stream().anyMatch(p -> "MANAGE_SYSTEM".equals(p.getCode())))
      || user.getGroups().stream().filter(com.slss.domain.PermissionGroup::isEnabled).anyMatch(group -> group.getPermissions().stream().anyMatch(p -> "MANAGE_SYSTEM".equals(p.getCode())));
  }
  private long countOtherSystemAdmins(Long excludedId) {
    return users.findAll().stream().filter(u -> !u.getId().equals(excludedId) && "ACTIVE".equals(u.getStatus()) && hasSystemPermission(u)).count();
  }
}
