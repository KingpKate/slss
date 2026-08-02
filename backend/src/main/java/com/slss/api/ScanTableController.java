package com.slss.api;
import com.slss.domain.*;
import com.slss.repository.*;
import com.slss.service.AuditService;
import com.slss.service.TenantScopeService;
import jakarta.transaction.Transactional;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import java.time.Instant;
import java.util.*;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;

@RestController @RequestMapping("/api/v1/scan")
@PreAuthorize("hasAnyAuthority('PERM_CREATE_SCAN_TABLE','PERM_VIEW_PRODUCTION','PERM_MANAGE_PRODUCTION','PERM_MANAGE_SCAN_TEMPLATE')")
public class ScanTableController {
 private final ScanTemplateRepository templates; private final ScanTableRepository tables; private final ScanTableValueRepository values; private final com.slss.repository.ScanTemplateFieldRepository templateFields; private final AuditService audit; private final TenantScopeService tenantScope;
 public ScanTableController(ScanTemplateRepository t,ScanTableRepository s,ScanTableValueRepository v,com.slss.repository.ScanTemplateFieldRepository f,AuditService a,TenantScopeService ts){templates=t;tables=s;values=v;templateFields=f;audit=a;tenantScope=ts;}
 public record Field(String key,String label,String type,boolean required){}
 public record CustomFieldRequest(String key,String label,String type,boolean required,String afterKey){}
 public record TemplateRequest(String customerName,String model,String description,List<Field> fields){}
 public record TableRequest(Long templateId,int quantity,String dispatchOrderNo,boolean disableAutoFillPartModels){}
 public record Value(String fieldKey,String value){}
 private String actor(){return Optional.ofNullable(SecurityContextHolder.getContext().getAuthentication()).map(x->x.getName()).orElse("system");}
 private boolean hasAuthority(String code){var a=SecurityContextHolder.getContext().getAuthentication();return a!=null&&a.getAuthorities().stream().anyMatch(x->x.getAuthority().equals(code));}
 private void requireScanOperator(){if(!hasAuthority("PERM_OPERATE_SCAN")&&!hasAuthority("PERM_CREATE_SCAN_TABLE")&&!hasAuthority("PERM_MANAGE_PRODUCTION"))throw new ResponseStatusException(HttpStatus.FORBIDDEN,"缺少扫码录入权限 OPERATE_SCAN");}
 @GetMapping("/templates") @Transactional public List<Map<String,Object>> listTemplates(){return templates.findByActiveTrueOrderByCustomerNameAscModelAsc().stream().filter(t->tenantScope.canAccess(t.getTenant())).map(this::templateDto).toList();}
 @GetMapping("/templates/page") @Transactional public Map<String,Object> listTemplatesPage(@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size){var pageable=PageRequest.of(Math.max(0,page),Math.min(Math.max(size,1),100),Sort.by(Sort.Direction.ASC,"customerName","model"));var ids=tenantScope.currentTenantIds();var p=ids.isEmpty()?templates.findByActiveTrue(pageable):templates.findByActiveTrueAndTenant_IdIn(ids,pageable);var content=p.getContent().stream().map(this::templateDto).toList();return pageDto(content,p.getNumber(),p.getSize(),p.getTotalElements(),p.getTotalPages());}
 @PostMapping("/templates") @PreAuthorize("hasAuthority('PERM_MANAGE_SCAN_TEMPLATE')") @Transactional public Map<String,Object> createTemplate(@RequestBody TemplateRequest r){
   if(r.customerName()==null||r.customerName().isBlank()||r.model()==null||r.model().isBlank()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"客户名称和整机型号不能为空");
   if(templates.findByActiveTrueAndCustomerNameIgnoreCaseAndModelIgnoreCase(r.customerName().trim(),r.model().trim()).isPresent()) throw new ResponseStatusException(HttpStatus.CONFLICT,"同一客户下整机型号不能重复");
   var t=new ScanTemplate();t.setCustomerName(r.customerName().trim());t.setModel(r.model().trim());t.setDescription(r.description());t.setCreatedBy(actor());t.setTenant(tenantScope.tenantForCreate(t.getCustomerName()));
   int i=0; var usedKeys=new HashSet<String>();
   for(var f:r.fields()==null?List.<Field>of():r.fields()){
     var base=(f.key()==null||f.key().isBlank())?"field"+(i+1):f.key().trim();var key=base;var suffix=2;
     while(!usedKeys.add(key.toLowerCase(Locale.ROOT)))key=base+"_"+suffix++;
     var x=new ScanTemplateField();x.setTemplate(t);x.setFieldKey(key);x.setFieldLabel(f.label()==null||f.label().isBlank()?key:f.label().trim());x.setFieldType(f.type()==null?"SN":f.type());x.setRequired(f.required());x.setSortOrder(i++);t.getFields().add(x);
   } return templateDto(templates.save(t));
 }
 @PutMapping("/templates/{id}") @PreAuthorize("hasAuthority('PERM_MANAGE_SCAN_TEMPLATE')") @Transactional public Map<String,Object> updateTemplate(@PathVariable Long id,@RequestBody TemplateRequest r){
   if(r.customerName()==null||r.customerName().isBlank()||r.model()==null||r.model().isBlank()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"客户名称和整机型号不能为空");
   var t=templates.findById(id).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"扫码模板不存在")); tenantScope.requireAccess(t.getTenant());
   var duplicate=templates.findByActiveTrueAndCustomerNameIgnoreCaseAndModelIgnoreCase(r.customerName().trim(),r.model().trim());
   if(duplicate.isPresent()&&!duplicate.get().getId().equals(id)) throw new ResponseStatusException(HttpStatus.CONFLICT,"同一客户下整机型号不能重复");
   t.setCustomerName(r.customerName().trim());t.setModel(r.model().trim());t.setDescription(r.description());
   // Keep the existing field entities when editing a template. Rebuilding the
   // collection in one transaction can make Hibernate insert a replacement
   // before orphanRemoval deletes the old unique (template_id, field_key) row,
   // which causes a MySQL duplicate-key error even when the mapping is
   // unchanged. Field mapping changes are handled by the dedicated column
   // operations; basic template edits must never fail because of that key.
   audit.record(actor(),"SCAN_TEMPLATE_UPDATE","SCAN_TEMPLATE",String.valueOf(id),"更新扫码模板: "+t.getCustomerName()+"/"+t.getModel(),null,true);
   return templateDto(templates.save(t));
 }
 @DeleteMapping("/templates/{id}") @PreAuthorize("hasAuthority('PERM_MANAGE_SCAN_TEMPLATE')") @Transactional public void deleteTemplate(@PathVariable Long id){var t=templates.findById(id).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"扫码模板不存在"));tenantScope.requireAccess(t.getTenant());t.setActive(false);templates.save(t);audit.record(actor(),"SCAN_TEMPLATE_DELETE","SCAN_TEMPLATE",String.valueOf(id),"软删除扫码模板: "+t.getCustomerName()+"/"+t.getModel(),null,true);}
 @GetMapping("/tables") @Transactional public List<Map<String,Object>> listTables(){
   return tables.findByStatusOrderByCreatedAtDesc("OPEN").stream().filter(t->tenantScope.canAccess(t.getTenant())).map(this::tableDto).toList();
 }
 @GetMapping("/tables/page") @Transactional public Map<String,Object> listTablesPage(@RequestParam(defaultValue="OPEN") String status,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size){var pageable=PageRequest.of(Math.max(0,page),Math.min(Math.max(size,1),100),Sort.by(Sort.Direction.DESC,"createdAt"));var ids=tenantScope.currentTenantIds();var p=ids.isEmpty()?tables.findByStatus(status,pageable):tables.findByStatusAndTenant_IdIn(status,ids,pageable);var content=p.getContent().stream().map(this::tableDto).toList();return pageDto(content,p.getNumber(),p.getSize(),p.getTotalElements(),p.getTotalPages());}
 @GetMapping("/tables/all") @Transactional public List<Map<String,Object>> listAllTables(){
   return tables.findAll().stream().filter(t->tenantScope.canAccess(t.getTenant())).sorted(Comparator.comparing(ScanTable::getCreatedAt,Comparator.nullsLast(Comparator.reverseOrder()))).map(t->tableDto(t,true)).toList();
 }
 @PostMapping("/tables") @PreAuthorize("hasAuthority('PERM_CREATE_SCAN_TABLE')") @Transactional public Map<String,Object> createTable(@RequestBody TableRequest r){
   var t=templates.findById(r.templateId()).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"扫码模板不存在")); tenantScope.requireAccess(t.getTenant());
   if(!t.isActive()) throw new ResponseStatusException(HttpStatus.CONFLICT,"扫码模板已停用，无法创建扫码表");
   if(r.quantity()<1||r.quantity()>5000) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"生产数量必须在 1-5000 之间");
   var table=new ScanTable();table.setTemplate(t);table.setTenant(t.getTenant());table.setCustomerName(t.getCustomerName());table.setModel(t.getModel());table.setDispatchOrderNo(r.dispatchOrderNo()==null?null:r.dispatchOrderNo().trim());table.setDisableAutoFillPartModels(r.disableAutoFillPartModels());table.setQuantity(r.quantity());table.setCreatedBy(actor());
   var machineModelKeys=t.getFields().stream()
     .filter(f->"model".equalsIgnoreCase(f.getFieldKey())||f.getFieldLabel().contains("整机型号"))
     .map(ScanTemplateField::getFieldKey).toList();
   for(int i=1;i<=r.quantity();i++){
     var row=new ScanTableRow();row.setScanTable(table);row.setRowNumber(i);
     for(var key:machineModelKeys){var value=new ScanTableValue();value.setRow(row);value.setFieldKey(key);value.setFieldValue(t.getModel());value.setOperatorNo(null);value.setScannedAt(null);row.getValues().add(value);}
     table.getRows().add(row);
   } return tableDto(tables.save(table));
 }
 @PutMapping("/tables/{id}/rows/{rowNumber}") @PreAuthorize("hasAnyAuthority('PERM_VIEW_PRODUCTION','PERM_CREATE_SCAN_TABLE','PERM_MANAGE_PRODUCTION')") @Transactional public Map<String,Object> saveRow(@PathVariable Long id,@PathVariable int rowNumber,@RequestParam(required=false) Long version,@RequestBody List<Value> values){
   requireScanOperator();
   var table=tables.findById(id).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"扫码表不存在")); tenantScope.requireAccess(table.getTenant());
   var row=table.getRows().stream().filter(x->x.getRowNumber()==rowNumber).findFirst().orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"扫码行不存在"));
   requireVersion(row,version);
   if("CANCELLED".equals(row.getStatus())) throw new ResponseStatusException(HttpStatus.CONFLICT,"已取消扫码行不能修改");
   if("COMPLETED".equals(row.getStatus())&&!hasAuthority("PERM_FORCE_EDIT_COMPLETED_SCAN")) throw new ResponseStatusException(HttpStatus.FORBIDDEN,"已完工行不允许修改，需 PERM_FORCE_EDIT_COMPLETED_SCAN 权限");
   if("COMPLETED".equals(row.getStatus())) { row.setStatus("IN_PROGRESS"); row.setCompletedBy(null); row.setCompletedAt(null); }
   if("COMPLETED".equals(row.getStatus())&&!hasAuthority("PERM_FORCE_EDIT_COMPLETED_SCAN"))throw new ResponseStatusException(HttpStatus.FORBIDDEN,"已完工行不允许修改，需 PERM_FORCE_EDIT_COMPLETED_SCAN 权限");
   var allowed=allowedFieldKeys(table);
   if(values==null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"扫码数据不能为空");
   for(var v:values){
     if(v==null||v.fieldKey()==null||v.fieldKey().isBlank()) continue;
     if(!allowed.contains(v.fieldKey())) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"无效的扫码字段："+v.fieldKey());
   }
   // Validate all submitted serials before mutating the managed entity. This
   // prevents a partial save when a duplicate is found in another device or
   // in a second column of the same row.
   var submittedSn = new HashMap<String,String>();
   for (var v : values) {
     if (v == null || v.fieldKey() == null || v.fieldKey().isBlank()) continue;
     var field = fieldDefinition(table, v.fieldKey());
     if (!field.sn()) continue;
     var value = Optional.ofNullable(v.value()).orElse("").trim();
     if (value.isBlank()) continue;
     var previous = submittedSn.putIfAbsent(value.toLowerCase(Locale.ROOT), v.fieldKey());
     if (previous != null && !previous.equals(v.fieldKey()) && !hasAuthority("PERM_FORCE_DUPLICATE_SN"))
       throw new ResponseStatusException(HttpStatus.CONFLICT, "SN " + value + " 在本行多个配件中重复使用（" + previous + " / " + v.fieldKey() + "）");
     if (!hasAuthority("PERM_FORCE_DUPLICATE_SN")) {
       var duplicate = findDuplicateScanValue(table, row, value);
       if (duplicate != null)
         throw new ResponseStatusException(HttpStatus.CONFLICT, "SN " + value + " 已绑定设备 " + duplicate.machineSn() + " 的配件 " + duplicate.fieldLabel());
     }
   }
   var byKey=new HashMap<String,ScanTableValue>();row.getValues().forEach(x->byKey.put(x.getFieldKey(),x));
   for(var v:values){if(v==null||v.fieldKey()==null||v.fieldKey().isBlank())continue;var x=byKey.computeIfAbsent(v.fieldKey(),k->{var n=new ScanTableValue();n.setRow(row);n.setFieldKey(k);row.getValues().add(n);return n;});var value=Optional.ofNullable(v.value()).orElse("").trim();var field=fieldDefinition(table,v.fieldKey());var isSn=field.sn();x.setFieldValue(value);x.setOperatorNo(isSn&& !value.isBlank()?actor():null);x.setScannedAt(isSn&& !value.isBlank()?Instant.now():null);if(field.machine()&&isSn)row.setMachineSn(value.isBlank()?null:value);}
   if(!values.isEmpty() && "OPEN".equals(row.getStatus())) row.setStatus("IN_PROGRESS");
   return tableDto(tables.save(table));
 }

 private record FieldInfo(boolean sn, boolean machine, String label) {}
 private FieldInfo fieldDefinition(ScanTable table, String key) {
   var field = table.getTemplate().getFields().stream().filter(f -> key.equals(f.getFieldKey())).findFirst().orElse(null);
   if (field != null) {
     var label = Optional.ofNullable(field.getFieldLabel()).orElse(key);
     return new FieldInfo("SN".equalsIgnoreCase(field.getFieldType()) || (label.matches(".*(SN|序列号|Serial).*") && !label.matches(".*型号.*")), label.matches(".*整机.*(SN|序列号).*" ) || "machine_sn".equalsIgnoreCase(key), label);
   }
   if (table.getCustomFieldDefs() != null) for (var definition : table.getCustomFieldDefs().split("\\n")) {
     var parts = definition.split("\\|", -1); if (parts.length >= 2 && key.equals(parts[0])) {
       var label = parts[1]; var type = parts.length >= 4 ? parts[3] : "";
       return new FieldInfo("SN".equalsIgnoreCase(type) || label.matches(".*(SN|序列号|Serial).*") && !label.matches(".*型号.*"), label.matches(".*整机.*(SN|序列号).*" ) || "machine_sn".equalsIgnoreCase(key), label);
     }
   }
   return new FieldInfo(false, false, key);
 }
 private record DuplicateInfo(String machineSn, String fieldLabel) {}
 private DuplicateInfo findDuplicateScanValue(ScanTable current, ScanTableRow currentRow, String value) {
   var candidates = current.getTenant() == null
       ? values.findByValueWithoutTenant(value)
       : values.findByValueAndTenant(value, current.getTenant().getId());
   for (var candidateValue : candidates) {
     var candidateRow = candidateValue.getRow();
     if (candidateRow.getId() != null && candidateRow.getId().equals(currentRow.getId())) continue;
     var candidateTable = candidateRow.getScanTable();
     var info = fieldDefinition(candidateTable, candidateValue.getFieldKey());
     if (!info.sn()) continue;
     var machine = Optional.ofNullable(candidateRow.getMachineSn()).filter(x -> !x.isBlank()).orElseGet(() -> candidateRow.getValues().stream().filter(v -> fieldDefinition(candidateTable, v.getFieldKey()).machine()).map(ScanTableValue::getFieldValue).filter(x -> x != null && !x.isBlank()).findFirst().orElse(candidateTable.getModel() + "#" + candidateRow.getRowNumber()));
     return new DuplicateInfo(machine, info.label());
   }
   return null;
 }

 private Set<String> allowedFieldKeys(ScanTable table){
   var hidden=table.getHiddenFieldKeys()==null?Set.<String>of():new HashSet<>(Arrays.asList(table.getHiddenFieldKeys().split(",")));
   var allowed=new HashSet<String>();
   table.getTemplate().getFields().forEach(f->{if(!hidden.contains(f.getFieldKey())) allowed.add(f.getFieldKey());});
   if(table.getCustomFieldDefs()!=null&&!table.getCustomFieldDefs().isBlank()){
     for(var definition:table.getCustomFieldDefs().split("\\n")){
       var parts=definition.split("\\|",-1);
       if(parts.length>=2&&!parts[0].isBlank()&&!hidden.contains(parts[0])) allowed.add(parts[0]);
     }
   }
   return allowed;
 }
 @PostMapping("/tables/{id}/fields") @PreAuthorize("hasAuthority('PERM_ADD_PRODUCTION_COLUMN')") @Transactional public Map<String,Object> addField(@PathVariable Long id,@RequestBody CustomFieldRequest f){
   var table=tables.findById(id).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"扫码表不存在")); tenantScope.requireAccess(table.getTenant());
   if(f.key()==null||f.key().isBlank()||f.label()==null||f.label().isBlank())throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"列名称不能为空");
   var defs=new ArrayList<String>();if(table.getCustomFieldDefs()!=null&&!table.getCustomFieldDefs().isBlank())defs.addAll(Arrays.asList(table.getCustomFieldDefs().split("\\n")));
   if(defs.stream().anyMatch(x->x.startsWith(f.key()+"|")))throw new ResponseStatusException(HttpStatus.CONFLICT,"列已存在");
   defs.add(f.key()+"|"+f.label().replace("|","/")+"|"+Optional.ofNullable(f.afterKey()).orElse("").replace("|","")+"|"+Optional.ofNullable(f.type()).orElse("TEXT"));table.setCustomFieldDefs(String.join("\n",defs));return tableDto(tables.save(table));
 }
 @PostMapping("/tables/{id}/rows/{rowNumber}/complete") @PreAuthorize("hasAnyAuthority('PERM_VIEW_PRODUCTION','PERM_CREATE_SCAN_TABLE','PERM_MANAGE_PRODUCTION')") @Transactional public Map<String,Object> completeRow(@PathVariable Long id,@PathVariable int rowNumber,@RequestParam(required=false) Long version){
   requireScanOperator();
   var table=tables.findById(id).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"扫码表不存在")); tenantScope.requireAccess(table.getTenant());
   var row=table.getRows().stream().filter(x->x.getRowNumber()==rowNumber).findFirst().orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"扫码行不存在"));
   requireVersion(row,version);
   if("COMPLETED".equals(row.getStatus())||"CANCELLED".equals(row.getStatus())) throw new ResponseStatusException(HttpStatus.CONFLICT,"扫码行已处于结束状态");
   var hidden=table.getHiddenFieldKeys()==null?Set.<String>of():new HashSet<>(Arrays.asList(table.getHiddenFieldKeys().split(",")));
   var required=table.getTemplate().getFields().stream().filter(f->!hidden.contains(f.getFieldKey())).filter(ScanTemplateField::isRequired).map(ScanTemplateField::getFieldKey).toList();
   var missing=required.stream().filter(k->{
     var field=table.getTemplate().getFields().stream().filter(f->k.equals(f.getFieldKey())).findFirst().orElse(null);
     if(field!=null&&("model".equalsIgnoreCase(k)||field.getFieldLabel().contains("整机型号")))return false;
     return row.getValues().stream().noneMatch(v->k.equals(v.getFieldKey())&&v.getFieldValue()!=null&&!v.getFieldValue().isBlank());
   }).toList();
   if(!missing.isEmpty()&&!hasAuthority("PERM_FORCE_COMPLETE_SCAN"))throw new ResponseStatusException(HttpStatus.FORBIDDEN,"必填项尚未全部录入，强制完工需 PERM_FORCE_COMPLETE_SCAN 权限："+String.join("、",missing));
   row.setStatus("COMPLETED");row.setCompletedBy(actor());row.setCompletedAt(Instant.now());if(table.getRows().stream().allMatch(x->"COMPLETED".equals(x.getStatus())||"CANCELLED".equals(x.getStatus())))table.setStatus("COMPLETED");return tableDto(tables.save(table));
 }
 @PostMapping("/tables/{id}/rows/{rowNumber}/cancel") @PreAuthorize("hasAnyAuthority('PERM_MANAGE_PRODUCTION','PERM_CREATE_SCAN_TABLE')") @Transactional public Map<String,Object> cancelRow(@PathVariable Long id,@PathVariable int rowNumber,@RequestParam(required=false) Long version){var table=tables.findById(id).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"扫码表不存在"));tenantScope.requireAccess(table.getTenant());var row=table.getRows().stream().filter(x->x.getRowNumber()==rowNumber).findFirst().orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"扫码行不存在"));requireVersion(row,version);if("COMPLETED".equals(row.getStatus())||"CANCELLED".equals(row.getStatus()))throw new ResponseStatusException(HttpStatus.CONFLICT,"扫码行已处于结束状态");row.setStatus("CANCELLED");if(table.getRows().stream().allMatch(x->"COMPLETED".equals(x.getStatus())||"CANCELLED".equals(x.getStatus())))table.setStatus("COMPLETED");return tableDto(tables.save(table));}
 @DeleteMapping("/tables/{id}") @PreAuthorize("hasAuthority('PERM_DELETE_SCAN_TABLE')") @Transactional public void delete(@PathVariable Long id){if(!tables.existsById(id))throw new ResponseStatusException(HttpStatus.NOT_FOUND,"扫码表不存在");tables.deleteById(id);audit.record(actor(),"SCAN_TABLE_DELETE","SCAN_TABLE",String.valueOf(id),"删除扫码表",null,true);}
 @DeleteMapping("/tables/{id}/fields/{fieldKey}") @PreAuthorize("hasAuthority('PERM_DELETE_PRODUCTION_COLUMN')") @Transactional public Map<String,Object> deleteField(@PathVariable Long id,@PathVariable String fieldKey){
   var table=tables.findById(id).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"扫码表不存在")); tenantScope.requireAccess(table.getTenant());
   var field=table.getTemplate().getFields().stream().filter(f->fieldKey.equals(f.getFieldKey())).findFirst().orElse(null);
   if(field!=null&&("model".equalsIgnoreCase(fieldKey)||field.getFieldLabel().contains("整机型号")))throw new ResponseStatusException(HttpStatus.CONFLICT,"整机型号为系统字段，不能删除");
   var hidden=new LinkedHashSet<String>();if(table.getHiddenFieldKeys()!=null&&!table.getHiddenFieldKeys().isBlank())hidden.addAll(Arrays.asList(table.getHiddenFieldKeys().split(",")));hidden.add(fieldKey);table.setHiddenFieldKeys(String.join(",",hidden));
   table.getRows().forEach(row->row.getValues().removeIf(value->fieldKey.equals(value.getFieldKey())));
   return tableDto(tables.save(table));
 }
 private Map<String,Object> templateDto(ScanTemplate t){var m=new LinkedHashMap<String,Object>();m.put("id",t.getId());m.put("customerName",t.getCustomerName());m.put("model",t.getModel());m.put("description",Optional.ofNullable(t.getDescription()).orElse(""));m.put("active",t.isActive());m.put("createdAt",t.getCreatedAt());m.put("fields",t.getFields().stream().sorted(Comparator.comparingInt(ScanTemplateField::getSortOrder)).map(f->Map.of("fieldKey",f.getFieldKey(),"fieldLabel",f.getFieldLabel(),"fieldType",f.getFieldType(),"required",f.isRequired())).toList());return m;}
 private List<Map<String,Object>> tableFields(ScanTable t){var hidden=t.getHiddenFieldKeys()==null?Set.<String>of():new HashSet<>(Arrays.asList(t.getHiddenFieldKeys().split(",")));var out=new ArrayList<Map<String,Object>>();t.getTemplate().getFields().stream().filter(f->!hidden.contains(f.getFieldKey())).sorted(Comparator.comparingInt(ScanTemplateField::getSortOrder)).forEach(f->out.add(Map.of("fieldKey",f.getFieldKey(),"fieldLabel",f.getFieldLabel(),"fieldType",f.getFieldType(),"required",f.isRequired())));if(t.getCustomFieldDefs()!=null)for(var d:t.getCustomFieldDefs().split("\\n")){var p=d.split("\\|",-1);if(p.length>=2&&!hidden.contains(p[0])){var type=p.length>=4?p[3]:(p[1].toLowerCase().contains("sn")?"SN":"TEXT");var item=Map.<String,Object>of("fieldKey",p[0],"fieldLabel",p[1],"fieldType",type,"required",false);var after=p.length>=3?p[2]:"";var position=-1;for(var i=0;i<out.size();i++)if(after.equals(out.get(i).get("fieldKey")))position=i;out.add(position>=0?position+1:out.size(),item);}}return out;}
 private Map<String,Object> tableDto(ScanTable t){return tableDto(t,false);}
 private Map<String,Object> tableDto(ScanTable t,boolean includeCompleted){var m=new LinkedHashMap<String,Object>();var template=templateDto(t.getTemplate());template.put("fields",tableFields(t));var hidden=t.getHiddenFieldKeys()==null?Set.<String>of():new HashSet<>(Arrays.asList(t.getHiddenFieldKeys().split(",")));m.put("id",t.getId());m.put("customerName",t.getCustomerName());m.put("model",t.getModel());m.put("dispatchOrderNo",Optional.ofNullable(t.getDispatchOrderNo()).orElse(""));m.put("disableAutoFillPartModels",t.isDisableAutoFillPartModels());m.put("quantity",t.getQuantity());m.put("status",t.getStatus());m.put("createdAt",t.getCreatedAt());m.put("template",template);m.put("rows",t.getRows().stream().filter(r->includeCompleted||(!"COMPLETED".equals(r.getStatus())&&!"CANCELLED".equals(r.getStatus()))).map(r->Map.of("id",r.getId(),"rowNumber",r.getRowNumber(),"status",r.getStatus(),"version",Optional.ofNullable(r.getVersion()).orElse(0L),"values",r.getValues().stream().filter(v->!hidden.contains(v.getFieldKey())).map(v->Map.of("fieldKey",v.getFieldKey(),"value",Optional.ofNullable(v.getFieldValue()).orElse(""),"operatorNo",Optional.ofNullable(v.getOperatorNo()).orElse(""))).toList())).toList());return m;}
 private void requireVersion(ScanTableRow row, Long expected){if(expected!=null&&!Objects.equals(expected,row.getVersion()))throw new ResponseStatusException(HttpStatus.CONFLICT,"扫码行已被其他用户修改，请刷新后重试");}
 private Map<String,Object> pageDto(List<?> content,int page,int size,long total,int pages){var m=new LinkedHashMap<String,Object>();m.put("content",content);m.put("page",page);m.put("size",size);m.put("totalElements",total);m.put("totalPages",pages);return m;}
}
