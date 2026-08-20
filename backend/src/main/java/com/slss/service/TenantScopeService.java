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
  /**
   * Tenant boundaries fail closed.  Records created before tenant assignment
   * remain intact for migration/admin review, but must not become globally
   * visible to ordinary users.  A future explicit GLOBAL scope should be
   * represented by a dedicated policy rather than a nullable tenant column.
   */
  public boolean canAccess(CustomerTenant tenant) {
    if (isSystemAdmin()) return true;
    var ids = currentTenantIds();
    // Backward-compatible boundary for production data created before tenant
    // assignment was introduced.  An account with no explicit tenant scope
    // may see only legacy rows whose tenant is still NULL; it never gains
    // access to data already assigned to another tenant.  As soon as the
    // account is bound to a tenant, NULL rows are no longer visible.
    // NULL tenant rows are legacy production records. Keep them available to
    // unscoped legacy accounts and explicitly authorised repair operators,
    // while preventing ordinary tenant-scoped users from bypassing the
    // tenant boundary through old rows.
    if (tenant == null) {
      var auth = SecurityContextHolder.getContext().getAuthentication();
      var repairOperator = auth != null && auth.getAuthorities().stream()
          .anyMatch(a -> "PERM_MANAGE_PRODUCTION_REPAIR".equals(a.getAuthority()));
      // A user explicitly bound to every active tenant has global read scope
      // for legacy rows whose tenant_id is still NULL. This keeps historical
      // production data visible without weakening scoped users.
      var allActive = tenants.findActiveIds();
      return ids.isEmpty() || repairOperator || (!allActive.isEmpty() && ids.containsAll(allActive));
    }
    return ids.contains(tenant.getId());
  }
  public void requireAccess(CustomerTenant tenant) { if(!canAccess(tenant)) throw new ResponseStatusException(HttpStatus.FORBIDDEN,"无权访问该租户数据"); }
  @org.springframework.transaction.annotation.Transactional
  public CustomerTenant tenantForCreate(String customerName) {
    if(isSystemAdmin()) {
      var existing=tenants.findAll().stream().filter(t->"ACTIVE".equals(t.getStatus()) && customerName!=null && (customerName.equalsIgnoreCase(t.getTenantName())||customerName.equalsIgnoreCase(t.getTenantCode()))).findFirst();
      if(existing.isPresent()) return existing.get();
      // System administrators may create data before tenant master data is
      // configured. Create a deterministic tenant so new templates/tables do
      // not become permanently invisible to non-admin users.
      var tenant=new CustomerTenant();
      tenant.setTenantName(customerName.trim());
      tenant.setTenantCode("CUSTOMER_"+customerName.trim().replaceAll("[^A-Za-z0-9\\u4e00-\\u9fa5]+","_").toUpperCase(java.util.Locale.ROOT));
      return tenants.save(tenant);
    }
    var ids=currentTenantIds(); if(ids.isEmpty()) throw new ResponseStatusException(HttpStatus.FORBIDDEN,"当前账号未绑定租户");
    return tenants.findById(ids.iterator().next()).orElseThrow(()->new ResponseStatusException(HttpStatus.FORBIDDEN,"租户不存在或已停用"));
  }
}
