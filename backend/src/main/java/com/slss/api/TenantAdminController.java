package com.slss.api;
import com.slss.domain.*; import com.slss.repository.*; import com.slss.service.AuditService; import org.springframework.data.domain.Page; import org.springframework.data.domain.Pageable; import jakarta.transaction.Transactional; import jakarta.validation.Valid; import jakarta.validation.constraints.NotBlank; import org.springframework.security.access.prepost.PreAuthorize; import org.springframework.security.core.context.SecurityContextHolder; import org.springframework.web.bind.annotation.*; import org.springframework.web.server.ResponseStatusException; import org.springframework.http.HttpStatus; import java.util.*;
@RestController @RequestMapping("/api/v1/admin/tenants") @PreAuthorize("hasAuthority('PERM_MANAGE_SYSTEM')")
public class TenantAdminController {
 private final CustomerTenantRepository tenants; private final UserRepository users; private final UserTenantLinkRepository links; private final AssetRepository assets; private final ScanTemplateRepository templates; private final ScanTableRepository tables; private final AuditService audit;
 public TenantAdminController(CustomerTenantRepository t,UserRepository u,UserTenantLinkRepository l,AssetRepository a,ScanTemplateRepository st,ScanTableRepository sb,AuditService au){tenants=t;users=u;links=l;assets=a;templates=st;tables=sb;audit=au;}
 public record CreateRequest(@NotBlank String tenantCode,@NotBlank String tenantName){} public record TenantResponse(Long id,String tenantCode,String tenantName,String status){}
 private TenantResponse dto(CustomerTenant t){return new TenantResponse(t.getId(),t.getTenantCode(),t.getTenantName(),t.getStatus());}
 @GetMapping public PageResponse<TenantResponse> list(Pageable pageable){return PageResponse.of(tenants.findAll(pageable).map(this::dto));}
 @PostMapping public TenantResponse create(@Valid @RequestBody CreateRequest r){var t=new CustomerTenant();t.setTenantCode(r.tenantCode().trim());t.setTenantName(r.tenantName().trim());return dto(tenants.save(t));}
 @PutMapping("/{tenantId}/users/{userId}") @Transactional public void bind(@PathVariable Long tenantId,@PathVariable Long userId){var t=tenants.findById(tenantId).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"租户不存在"));var u=users.findById(userId).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"用户不存在"));links.save(new UserTenantLink(u,t));}
 @PutMapping("/{tenantId}/assets/{machineSn}") @Transactional public void migrateAsset(@PathVariable Long tenantId,@PathVariable String machineSn){var t=tenants.findById(tenantId).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"租户不存在"));var a=assets.findByMachineSnIgnoreCase(machineSn).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"资产不存在"));a.setTenant(t);assets.save(a);audit.record(actor(),"ASSET_TENANT_MIGRATE","ASSET",machineSn,"资产迁移至租户: "+t.getTenantCode(),null,true);}
 @PostMapping("/{tenantId}/scan-data/migrate") @Transactional public Map<String,Object> migrateScanData(@PathVariable Long tenantId,@RequestParam String customerName){
   var t=tenants.findById(tenantId).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"租户不存在"));
   if(customerName==null||customerName.isBlank()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"客户名称不能为空");
   var migratedTemplates=templates.findByTenantIsNullAndCustomerNameIgnoreCase(customerName.trim()); migratedTemplates.forEach(x->x.setTenant(t)); templates.saveAll(migratedTemplates);
   var migratedTables=tables.findByTenantIsNullAndCustomerNameIgnoreCase(customerName.trim()); migratedTables.forEach(x->x.setTenant(t)); tables.saveAll(migratedTables);
   audit.record(actor(),"SCAN_DATA_TENANT_MIGRATE","TENANT",String.valueOf(tenantId),"迁移扫码模板 "+migratedTemplates.size()+" 个、扫码表 "+migratedTables.size()+" 个，客户："+customerName.trim(),null,true);
   return Map.of("tenantId",tenantId,"customerName",customerName.trim(),"templates",migratedTemplates.size(),"scanTables",migratedTables.size());
 }
 private String actor(){return java.util.Optional.ofNullable(SecurityContextHolder.getContext().getAuthentication()).map(x->x.getName()).orElse("system");}
}
