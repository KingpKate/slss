package com.slss.service;

import com.slss.domain.CustomerTenant;
import com.slss.domain.User;
import com.slss.repository.CustomerTenantRepository;
import com.slss.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import java.util.Set;

/** Central tenant boundary used by production and after-sales APIs. */
@Service
public class TenantScopeService {
  private final UserRepository users;
  private final CustomerTenantRepository tenants;
  public TenantScopeService(UserRepository users, CustomerTenantRepository tenants) { this.users = users; this.tenants = tenants; }
  public boolean isSystemAdmin() { var auth=SecurityContextHolder.getContext().getAuthentication(); return auth!=null&&auth.getAuthorities().stream().anyMatch(a->"PERM_MANAGE_SYSTEM".equals(a.getAuthority())); }
  public Set<Long> currentTenantIds() { if(isSystemAdmin()) return Set.of(); var auth=SecurityContextHolder.getContext().getAuthentication(); if(auth==null)return Set.of(); return users.findByUsernameAndStatus(auth.getName(),"ACTIVE").map(User::getId).map(tenants::findActiveIdsByUserId).orElse(Set.of()); }
  public boolean canAccess(CustomerTenant tenant) { return isSystemAdmin() || (tenant!=null && currentTenantIds().contains(tenant.getId())); }
  public void requireAccess(CustomerTenant tenant) { if(!canAccess(tenant)) throw new ResponseStatusException(HttpStatus.FORBIDDEN,"无权访问该租户数据"); }
  public CustomerTenant tenantForCreate(String customerName) {
    if(isSystemAdmin()) return tenants.findAll().stream().filter(t->"ACTIVE".equals(t.getStatus()) && customerName!=null && (customerName.equalsIgnoreCase(t.getTenantName())||customerName.equalsIgnoreCase(t.getTenantCode()))).findFirst().orElse(null);
    var ids=currentTenantIds(); if(ids.isEmpty()) throw new ResponseStatusException(HttpStatus.FORBIDDEN,"当前账号未绑定租户");
    return tenants.findById(ids.iterator().next()).orElseThrow(()->new ResponseStatusException(HttpStatus.FORBIDDEN,"租户不存在或已停用"));
  }
}
