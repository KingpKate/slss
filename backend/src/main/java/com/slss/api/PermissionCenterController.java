package com.slss.api;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.slss.domain.*;
import com.slss.repository.*;
import com.slss.service.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.security.Principal;
import java.time.Instant;
import java.util.*;

@RestController
@RequestMapping("/api/v1/permission-center")
@PreAuthorize("hasAuthority('PERM_MANAGE_SYSTEM')")
public class PermissionCenterController {
  private final UserRepository users; private final PermissionCacheService cache; private final PermissionOverrideRepository overrides; private final PermissionScopeBindingRepository scopes; private final PermissionChangeRequestRepository requests; private final AuditLogRepository auditLogs; private final ObjectMapper mapper; private final AuditService audit;
  public PermissionCenterController(UserRepository u,PermissionCacheService c,PermissionOverrideRepository o,PermissionScopeBindingRepository s,PermissionChangeRequestRepository r,AuditLogRepository a,ObjectMapper m,AuditService audit){users=u;cache=c;overrides=o;scopes=s;requests=r;auditLogs=a;mapper=m;this.audit=audit;}
  public record PermissionDetail(Long userId,String username,List<String> roles,List<Long> groupIds,Set<String> effectivePermissions,Set<String> deniedPermissions,Map<String,List<String>> sources,Map<String,String> scopes,long cacheVersion){}
  public record OverrideRequest(@NotBlank String permissionCode,@NotBlank String effect){}
  public record ScopeRequest(@NotBlank String subjectType,Long subjectId,@NotBlank String permissionCode,@NotBlank String scopeType,String scopeValue,Long version){}
  public record ApprovalRequest(@NotBlank String targetType,Long targetId,@NotBlank String changeType,@NotBlank String payloadJson){}
  public record ReviewRequest(@NotBlank String decision,String comment,Long version){}

  @GetMapping("/users/{id}/detail") @Transactional(readOnly=true)
  public PermissionDetail detail(@PathVariable Long id){var u=users.findById(id).orElseThrow();var e=cache.evaluate(u.getUsername());return new PermissionDetail(id,u.getUsername(),u.getRoles().stream().map(Role::getCode).sorted().toList(),u.getGroups().stream().filter(g->g.getDeletedAt()==null).map(PermissionGroup::getId).toList(),e.allowed(),e.denied(),e.sources(),e.scopes(),e.version());}
  @GetMapping("/simulate") @Transactional(readOnly=true)
  public PermissionDetail simulate(@RequestParam String username){var u=users.findByUsernameAndStatus(username,"ACTIVE").orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"用户不存在或已禁用"));return detail(u.getId());}
  @PutMapping("/users/{id}/overrides") @Transactional
  public PermissionDetail overrides(@PathVariable Long id,@Valid @RequestBody List<OverrideRequest> body,Principal actor,HttpServletRequest request){var u=users.findById(id).orElseThrow();var existing=overrides.findByUserId(id);overrides.deleteAll(existing);for(var item:body){var effect=item.effect().toUpperCase(Locale.ROOT);if(!Set.of("ALLOW","DENY").contains(effect))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"effect 必须为 ALLOW 或 DENY");overrides.save(new PermissionOverride(id,normalize(item.permissionCode()),effect,actor.getName()));}cache.bump();audit.record(actor.getName(),"PERMISSION_OVERRIDE_UPDATE","USER",String.valueOf(id),body.toString(),request.getRemoteAddr(),true);return detail(id);}
  @GetMapping("/scopes") @Transactional(readOnly=true)
  public List<PermissionScopeBinding> scopes(@RequestParam String subjectType,@RequestParam Long subjectId){return scopes.findBySubjectTypeAndSubjectId(subjectType.toUpperCase(Locale.ROOT),subjectId);}
  @PutMapping("/scopes") @Transactional
  public PermissionScopeBinding saveScope(@Valid @RequestBody ScopeRequest r,Principal actor,HttpServletRequest request){var type=r.subjectType().toUpperCase(Locale.ROOT);var scopeType=r.scopeType().toUpperCase(Locale.ROOT);if(!Set.of("USER","GROUP").contains(type)||r.subjectId()==null)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"subjectType/subjectId 无效");if(!Set.of("ALL","TENANT","CUSTOMER","DEPARTMENT","TEAM","SELF").contains(scopeType))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"scopeType 必须为 ALL/TENANT/CUSTOMER/DEPARTMENT/TEAM/SELF");var s=new PermissionScopeBinding(type,r.subjectId(),normalize(r.permissionCode()),scopeType,r.scopeValue());s.setUpdatedBy(actor.getName());var saved=scopes.save(s);cache.bump();audit.record(actor.getName(),"PERMISSION_SCOPE_UPDATE",type,String.valueOf(r.subjectId()),scopeType+":"+r.scopeValue(),request.getRemoteAddr(),true);return saved;}
  @DeleteMapping("/scopes/{id}") @Transactional public void deleteScope(@PathVariable Long id,Principal actor,HttpServletRequest request){scopes.deleteById(id);cache.bump();audit.record(actor.getName(),"PERMISSION_SCOPE_DELETE","SCOPE",String.valueOf(id),null,request.getRemoteAddr(),true);}
  @GetMapping("/audit") @Transactional(readOnly=true)
  public PageResponse<AuditLog> permissionAudit(@RequestParam(defaultValue="") String action,@PageableDefault(size=50,sort="createdAt",direction=Sort.Direction.DESC) Pageable pageable){var page=action.isBlank()?auditLogs.findAll(pageable):auditLogs.findByActionContainingIgnoreCase(action,pageable);return PageResponse.of(page);}
  @PostMapping("/approvals") @Transactional
  public PermissionChangeRequest request(@Valid @RequestBody ApprovalRequest r,Principal actor,HttpServletRequest req){var saved=requests.save(new PermissionChangeRequest(r.targetType(),r.targetId(),r.changeType(),r.payloadJson(),actor.getName()));audit.record(actor.getName(),"PERMISSION_APPROVAL_REQUEST","PERMISSION_REQUEST",String.valueOf(saved.getId()),r.changeType(),req.getRemoteAddr(),true);return saved;}
  @GetMapping("/approvals") @Transactional(readOnly=true) public List<PermissionChangeRequest> approvals(@RequestParam(defaultValue="PENDING") String status){return requests.findByStatusOrderByRequestedAtDesc(status.toUpperCase(Locale.ROOT));}
  @PutMapping("/approvals/{id}") @Transactional
  public PermissionChangeRequest review(@PathVariable Long id,@Valid @RequestBody ReviewRequest r,Principal actor,HttpServletRequest req){var item=requests.findById(id).orElseThrow();if(!"PENDING".equals(item.getStatus()))throw new ResponseStatusException(HttpStatus.CONFLICT,"该审批已处理");var decision=r.decision().toUpperCase(Locale.ROOT);if(!Set.of("APPROVED","REJECTED").contains(decision))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"decision 必须为 APPROVED 或 REJECTED");if("APPROVED".equals(decision)&&"USER".equalsIgnoreCase(item.getTargetType())&&"OVERRIDE".equalsIgnoreCase(item.getChangeType())){try{var node=mapper.readTree(item.getPayloadJson());var code=normalize(node.get("permissionCode").asText());var effect=node.get("effect").asText().toUpperCase(Locale.ROOT);if("DENY".equals(effect)&&"MANAGE_SYSTEM".equals(code)){var target=users.findById(item.getTargetId()).orElseThrow();var otherAdmins=users.findAll().stream().filter(u->!u.getId().equals(target.getId())&&"ACTIVE".equals(u.getStatus())).filter(u->cache.evaluate(u.getUsername()).allowed().contains("MANAGE_SYSTEM")).count();if(otherAdmins==0)throw new ResponseStatusException(HttpStatus.CONFLICT,"不能拒绝系统中最后一个管理员权限");}overrides.findByUserIdAndPermissionCode(item.getTargetId(),code).ifPresent(overrides::delete);overrides.save(new PermissionOverride(item.getTargetId(),code,effect,actor.getName()));cache.bump();}catch(ResponseStatusException e){throw e;}catch(Exception e){throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"审批载荷无效");}}item.setStatus(decision);item.setReviewedBy(actor.getName());item.setReviewComment(r.comment());item.setReviewedAt(Instant.now());var saved=requests.save(item);audit.record(actor.getName(),"PERMISSION_APPROVAL_REVIEW","PERMISSION_REQUEST",String.valueOf(id),decision,req.getRemoteAddr(),true);return saved;}
  private String normalize(String code){return code.startsWith("PERM_")?code.substring(5):code;}
}
