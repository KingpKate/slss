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
@PreAuthorize("hasAnyAuthority('PERM_OPERATE_SCAN','PERM_CREATE_SCAN_TABLE','PERM_VIEW_PRODUCTION','PERM_MANAGE_PRODUCTION','PERM_MANAGE_SCAN_TEMPLATE')")
public class ScanTableController {
 private final ScanTemplateRepository templates; private final ScanTableRepository tables; private final ScanTableValueRepository values; private final com.slss.repository.ScanTemplateFieldRepository templateFields; private final AuditService audit; private final TenantScopeService tenantScope;
 public ScanTableController(ScanTemplateRepository t,ScanTableRepository s,ScanTableValueRepository v,com.slss.repository.ScanTemplateFieldRepository f,AuditService a,TenantScopeService ts){templates=t;tables=s;values=v;templateFields=f;audit=a;tenantScope=ts;}
 public record Field(String key,String label,String type,boolean required,Boolean enabled,Boolean scanRequired,Boolean requireModel,String section){}
 public record CustomFieldRequest(String key,String label,String type,boolean required,String afterKey,String section){}
 public record TemplateRequest(String customerName,String model,String description,List<Field> fields,Boolean active){}
 public record TableRequest(Long templateId,int quantity,String dispatchOrderNo,boolean disableAutoFillPartModels){}
 public record Value(String fieldKey,String value){}
 private String actor(){return Optional.ofNullable(SecurityContextHolder.getContext().getAuthentication()).map(x->x.getName()).orElse("system");}
 private boolean hasAuthority(String code){var a=SecurityContextHolder.getContext().getAuthentication();return a!=null&&a.getAuthorities().stream().anyMatch(x->x.getAuthority().equals(code));}
 private boolean canUseScanModule(){var a=SecurityContextHolder.getContext().getAuthentication();return a!=null&&a.getAuthorities().stream().anyMatch(x->Set.of("PERM_VIEW_PRODUCTION","PERM_OPERATE_SCAN","PERM_CREATE_SCAN_TABLE","PERM_MANAGE_PRODUCTION","PERM_MANAGE_SCAN_TEMPLATE").contains(x.getAuthority()));}
 private void requireScanTableAccess(CustomerTenant ignored){if(!canUseScanModule())throw new ResponseStatusException(HttpStatus.FORBIDDEN,"缺少扫码表模块权限");}
 private void requireScanOperator(){if(!hasAuthority("PERM_OPERATE_SCAN")&&!hasAuthority("PERM_CREATE_SCAN_TABLE")&&!hasAuthority("PERM_MANAGE_PRODUCTION"))throw new ResponseStatusException(HttpStatus.FORBIDDEN,"缺少扫码录入权限 OPERATE_SCAN");}
 @GetMapping("/templates") @Transactional public List<Map<String,Object>> listTemplates(){return templates.findByActiveTrueOrderByCustomerNameAscModelAsc().stream().map(this::templateDto).toList();}
 @GetMapping("/templates/page") @Transactional public Map<String,Object> listTemplatesPage(@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size){var pageable=PageRequest.of(Math.max(0,page),Math.min(Math.max(size,1),100),Sort.by(Sort.Direction.ASC,"customerName","model"));var p=templates.findByActiveTrue(pageable);var content=p.getContent().stream().map(this::templateDto).toList();return pageDto(content,p.getNumber(),p.getSize(),p.getTotalElements(),p.getTotalPages());}
 @PostMapping("/templates") @PreAuthorize("hasAuthority('PERM_MANAGE_SCAN_TEMPLATE')") @Transactional public Map<String,Object> createTemplate(@RequestBody TemplateRequest r){
   if(r.customerName()==null||r.customerName().isBlank()||r.model()==null||r.model().isBlank()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"客户名称和整机型号不能为空");
   if(templates.findByActiveTrueAndCustomerNameIgnoreCaseAndModelIgnoreCase(r.customerName().trim(),r.model().trim()).isPresent()) throw new ResponseStatusException(HttpStatus.CONFLICT,"同一客户下整机型号不能重复");
   var t=new ScanTemplate();t.setCustomerName(r.customerName().trim());t.setModel(r.model().trim());t.setDescription(r.description());t.setCreatedBy(actor());t.setTenant(tenantScope.tenantForCreate(t.getCustomerName()));
   int i=0; var usedKeys=new HashSet<String>();
   for(var f:r.fields()==null?List.<Field>of():r.fields()){
     var base=(f.key()==null||f.key().isBlank())?"field"+(i+1):f.key().trim();var key=base;var suffix=2;
     while(!usedKeys.add(key.toLowerCase(Locale.ROOT)))key=base+"_"+suffix++;
     var x=new ScanTemplateField();x.setTemplate(t);x.setFieldKey(key);x.setFieldLabel(f.label()==null||f.label().isBlank()?key:f.label().trim());x.setFieldType(f.type()==null?"SN":f.type());x.setRequired(f.required());x.setEnabled(f.enabled()==null||f.enabled());x.setScanRequired(f.scanRequired()!=null?f.scanRequired():"SN".equalsIgnoreCase(x.getFieldType()));x.setRequireModel(Boolean.TRUE.equals(f.requireModel()));x.setProcessSection(normalizeSection(f.section(), x.getFieldKey(), x.getFieldLabel()));x.setSortOrder(i++);t.getFields().add(x);
   } return templateDto(templates.save(t));
 }
 @PutMapping("/templates/{id}") @PreAuthorize("hasAuthority('PERM_MANAGE_SCAN_TEMPLATE')") @Transactional public Map<String,Object> updateTemplate(@PathVariable Long id,@RequestBody TemplateRequest r){
   if(r.customerName()==null||r.customerName().isBlank()||r.model()==null||r.model().isBlank()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"客户名称和整机型号不能为空");
   var t=templates.findById(id).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"扫码模板不存在")); tenantScope.requireAccess(t.getTenant());
   var duplicate=templates.findByActiveTrueAndCustomerNameIgnoreCaseAndModelIgnoreCase(r.customerName().trim(),r.model().trim());
   if(duplicate.isPresent()&&!duplicate.get().getId().equals(id)) throw new ResponseStatusException(HttpStatus.CONFLICT,"同一客户下整机型号不能重复");
   t.setCustomerName(r.customerName().trim());t.setModel(r.model().trim());t.setDescription(r.description());
   if(r.active()!=null)t.setActive(r.active());
   // Update existing field entities in place and only append/remove the
   // difference. Replacing the whole collection can make Hibernate treat
   // fields as stale detached rows and return a misleading optimistic-lock
   // conflict when an editor saves while the list refreshes in the UI.
   var incoming=r.fields()==null?List.<Field>of():r.fields();
   int i=0; var usedKeys=new HashSet<String>();
   var normalized=new ArrayList<Field>();
   for(var f:incoming){
     var base=(f.key()==null||f.key().isBlank())?"field"+(i+1):f.key().trim();var key=base;var suffix=2;
     while(!usedKeys.add(key.toLowerCase(Locale.ROOT)))key=base+"_"+suffix++;
     var type=f.type()==null?"SN":f.type(); normalized.add(new Field(key,f.label()==null||f.label().isBlank()?key:f.label().trim(),type,f.required(),f.enabled(),f.scanRequired(),f.requireModel(),f.section())); i++;
   }
   var existing=new ArrayList<>(t.getFields());
   // Free the unique-key namespace before applying a rename/reorder (for
   // example swapping CPU1/CPU2), otherwise MySQL can reject an intermediate
   // duplicate even though the final mapping is valid.
   for(i=0;i<existing.size();i++) existing.get(i).setFieldKey("__template_edit_"+id+"_"+i);
   templateFields.flush();
   for(i=0;i<normalized.size();i++){
     var f=normalized.get(i);
     if(i<existing.size()){
       var x=existing.get(i);x.setFieldKey(f.key());x.setFieldLabel(f.label());x.setFieldType(f.type());x.setRequired(f.required());x.setEnabled(f.enabled()==null||f.enabled());x.setScanRequired(f.scanRequired()!=null?f.scanRequired():"SN".equalsIgnoreCase(f.type()));x.setRequireModel(Boolean.TRUE.equals(f.requireModel()));x.setProcessSection(normalizeSection(f.section(), f.key(), f.label()));x.setSortOrder(i);
     }else{
       var x=new ScanTemplateField();x.setTemplate(t);x.setFieldKey(f.key());x.setFieldLabel(f.label());x.setFieldType(f.type());x.setRequired(f.required());x.setEnabled(f.enabled()==null||f.enabled());x.setScanRequired(f.scanRequired()!=null?f.scanRequired():"SN".equalsIgnoreCase(f.type()));x.setRequireModel(Boolean.TRUE.equals(f.requireModel()));x.setProcessSection(normalizeSection(f.section(), f.key(), f.label()));x.setSortOrder(i);t.getFields().add(x);
     }
   }
   if(existing.size()>normalized.size()){
     var removed=existing.subList(normalized.size(),existing.size());
     templateFields.deleteAll(removed);
     t.getFields().removeAll(removed);
     templateFields.flush();
   }
   audit.record(actor(),"SCAN_TEMPLATE_UPDATE","SCAN_TEMPLATE",String.valueOf(id),"更新扫码模板: "+t.getCustomerName()+"/"+t.getModel(),null,true);
   return templateDto(templates.save(t));
 }
 @DeleteMapping("/templates/{id}") @PreAuthorize("hasAuthority('PERM_MANAGE_SCAN_TEMPLATE')") @Transactional public void deleteTemplate(@PathVariable Long id){var t=templates.findById(id).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"扫码模板不存在"));tenantScope.requireAccess(t.getTenant());t.setActive(false);templates.save(t);audit.record(actor(),"SCAN_TEMPLATE_DELETE","SCAN_TEMPLATE",String.valueOf(id),"软删除扫码模板: "+t.getCustomerName()+"/"+t.getModel(),null,true);}
 @GetMapping("/tables") @Transactional public List<Map<String,Object>> listTables(){
   return tables.findByStatusInOrderByCreatedAtDesc(List.of("OPEN","IN_PROGRESS")).stream().peek(this::refreshAggregateStatus).filter(t -> !"COMPLETED".equals(t.getStatus())).map(this::tableDto).toList();
 }
 @GetMapping("/tables/completed") @Transactional public List<Map<String,Object>> listCompletedTables(){
   return tables.findAll().stream().filter(t->tenantScope.canAccess(t.getTenant())).peek(this::refreshAggregateStatus).filter(t -> "COMPLETED".equals(t.getStatus())).sorted(Comparator.comparing(ScanTable::getCreatedAt,Comparator.nullsLast(Comparator.reverseOrder()))).map(this::completedTableDto).toList();
 }
 @GetMapping("/tables/unfinished") @Transactional public List<Map<String,Object>> listUnfinishedTables(){
   return tables.findAll().stream().filter(t->tenantScope.canAccess(t.getTenant())).peek(this::refreshAggregateStatus).filter(t -> Set.of("OPEN","IN_PROGRESS").contains(t.getStatus())).sorted(Comparator.comparing(ScanTable::getCreatedAt,Comparator.nullsLast(Comparator.reverseOrder()))).map(this::completedTableDto).toList();
 }
 @GetMapping("/tables/{id}") @Transactional public Map<String,Object> getTable(@PathVariable Long id){
   var table=tables.findById(id).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"扫码表不存在"));
   requireScanTableAccess(table.getTenant());
   if(!Set.of("OPEN","IN_PROGRESS").contains(table.getStatus())) throw new ResponseStatusException(HttpStatus.NOT_FOUND,"扫码表不存在或已完工");
   return tableDto(table);
 }
 @GetMapping("/tables/{id}/machine/{machineSn}") @Transactional
 public Map<String,Object> findMachineRow(@PathVariable Long id,@PathVariable String machineSn){
   var table=tables.findById(id).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"扫码表不存在"));
   requireScanTableAccess(table.getTenant());
   var target=normalizeMachineSn(machineSn);
   if(target.isBlank()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"整机 SN 不能为空");
   var hidden=table.getHiddenFieldKeys()==null?Set.<String>of():new HashSet<>(Arrays.asList(table.getHiddenFieldKeys().split(",")));
   var row=table.getRows().stream().filter(r->matchesMachineSn(r,target)).findFirst()
     .orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"未找到该整机 SN 的扫码行"));
   return rowDto(row,hidden);
 }
 @GetMapping("/tables/page") @Transactional public Map<String,Object> listTablesPage(@RequestParam(defaultValue="ACTIVE") String status,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size){var pageable=PageRequest.of(Math.max(0,page),Math.min(Math.max(size,1),100),Sort.by(Sort.Direction.DESC,"createdAt"));var statuses="ACTIVE".equalsIgnoreCase(status)?List.of("OPEN","IN_PROGRESS"):List.of(status.toUpperCase(Locale.ROOT));var p=statuses.size()==1?tables.findByStatus(statuses.get(0),pageable):tables.findByStatusIn(statuses,pageable);var content=p.getContent().stream().map(this::tableDto).toList();return pageDto(content,p.getNumber(),p.getSize(),p.getTotalElements(),p.getTotalPages());}
 @GetMapping("/tables/all") @Transactional public List<Map<String,Object>> listAllTables(){
   // Keep the export source consistent with production statistics.  Legacy
   // rows without a tenant remain visible only to accounts without an
   // explicit tenant scope; tenant-assigned rows are never leaked through
   // this unpaged export helper.
   return tables.findAll().stream().filter(t -> tenantScope.canAccess(t.getTenant())).sorted(Comparator.comparing(ScanTable::getCreatedAt,Comparator.nullsLast(Comparator.reverseOrder()))).map(this::completedTableDto).toList();
 }
 @PostMapping("/tables") @PreAuthorize("hasAuthority('PERM_CREATE_SCAN_TABLE')") @Transactional public Map<String,Object> createTable(@RequestBody TableRequest r){
   var t=templates.findById(r.templateId()).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"扫码模板不存在")); requireScanTableAccess(t.getTenant());
   if(!t.isActive()) throw new ResponseStatusException(HttpStatus.CONFLICT,"扫码模板已停用，无法创建扫码表");
   if(r.quantity()<1||r.quantity()>5000) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"生产数量必须在 1-5000 之间");
   var table=new ScanTable();table.setTemplate(t);table.setTenant(t.getTenant());table.setCustomerName(t.getCustomerName());table.setModel(t.getModel());table.setDispatchOrderNo(r.dispatchOrderNo()==null?null:r.dispatchOrderNo().trim());table.setDisableAutoFillPartModels(r.disableAutoFillPartModels());table.setQuantity(r.quantity());table.setCreatedBy(actor());
   var machineModelKeys=t.getFields().stream()
     .filter(f->f.isEnabled() && ("model".equalsIgnoreCase(f.getFieldKey())||f.getFieldLabel().contains("整机型号")))
     .map(ScanTemplateField::getFieldKey).toList();
   for(int i=1;i<=r.quantity();i++){
     var row=new ScanTableRow();row.setScanTable(table);row.setRowNumber(i);
     for(var key:machineModelKeys){var value=new ScanTableValue();value.setRow(row);value.setFieldKey(key);value.setFieldValue(t.getModel());value.setOperatorNo(null);value.setScannedAt(null);row.getValues().add(value);}
     table.getRows().add(row);
   } return tableDto(tables.save(table));
 }
 @PutMapping("/tables/{id}/rows/{rowNumber}") @PreAuthorize("hasAnyAuthority('PERM_VIEW_PRODUCTION','PERM_CREATE_SCAN_TABLE','PERM_MANAGE_PRODUCTION')") @Transactional public Map<String,Object> saveRow(@PathVariable Long id,@PathVariable int rowNumber,@RequestParam(required=false) Long version,@RequestBody List<Value> values){
   requireScanOperator();
   var table=tables.findById(id).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"扫码表不存在")); requireScanTableAccess(table.getTenant());
   var row=table.getRows().stream().filter(x->x.getRowNumber()==rowNumber).findFirst().orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"扫码行不存在"));
   // A scan save changes only the submitted fields.  A whole-row optimistic
   // lock made two operators scanning different component columns block each
   // other with a false 409.  Merge safely when the current values of the
   // submitted fields are still blank or already equal; reject only when the
   // same field was actually changed by another operator.
   requireFieldVersion(row,version,values);
   if("CANCELLED".equals(row.getStatus())) throw new ResponseStatusException(HttpStatus.CONFLICT,"已取消扫码行不能修改");
   if("COMPLETED".equals(row.getStatus())&&!hasAuthority("PERM_FORCE_EDIT_COMPLETED_SCAN")) throw new ResponseStatusException(HttpStatus.FORBIDDEN,"已完工行不允许修改，需 PERM_FORCE_EDIT_COMPLETED_SCAN 权限");
   if("COMPLETED".equals(row.getStatus())) { row.setStatus("IN_PROGRESS"); row.setCompletedBy(null); row.setCompletedAt(null); }
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
   autoCompleteModelSteps(table,row);
   if(!values.isEmpty() && "OPEN".equals(row.getStatus())) row.setStatus("IN_PROGRESS");
   return tableDto(tables.save(table));
 }
 /** Backward-compatible Java service entry point used by existing callers/tests. */
 public Map<String,Object> saveRow(Long id,int rowNumber,List<Value> values){return saveRow(id,rowNumber,null,values);}

 private record FieldInfo(boolean sn, boolean machine, String label) {}
 private List<String> customDefinitions(ScanTable table) {
   var raw = Optional.ofNullable(table.getCustomFieldDefs()).orElse("");
   return Arrays.stream(raw.replace("\\n", "\n").split("\\R"))
     .map(String::trim).filter(x -> !x.isBlank()).toList();
 }
 private FieldInfo fieldDefinition(ScanTable table, String key) {
   var field = table.getTemplate().getFields().stream().filter(f -> key.equals(f.getFieldKey())).findFirst().orElse(null);
   if (field != null) {
     var label = Optional.ofNullable(field.getFieldLabel()).orElse(key);
     return new FieldInfo("SN".equalsIgnoreCase(field.getFieldType()) || (label.matches(".*(SN|序列号|Serial).*") && !label.matches(".*型号.*")), label.matches(".*整机.*(SN|序列号).*" ) || "machine_sn".equalsIgnoreCase(key), label);
   }
   for (var definition : customDefinitions(table)) {
     var parts = definition.split("\\|", -1); if (parts.length >= 2 && key.equals(parts[0])) {
       var label = parts[1]; var type = parts.length >= 4 ? parts[3] : "";
       return new FieldInfo("SN".equalsIgnoreCase(type) || label.matches(".*(SN|序列号|Serial).*") && !label.matches(".*型号.*"), label.matches(".*整机.*(SN|序列号).*" ) || "machine_sn".equalsIgnoreCase(key), label);
     }
   }
   if (key.endsWith("__model")) return new FieldInfo(false, false, key.substring(0, key.length()-7)+" 型号");
   return new FieldInfo(false, false, key);
 }
 private void autoCompleteModelSteps(ScanTable table, ScanTableRow row) {
   var fields=table.getTemplate().getFields().stream().filter(ScanTemplateField::isEnabled)
     .sorted(Comparator.comparingInt(ScanTemplateField::getSortOrder)).toList();
   var values=new HashMap<String,String>(); row.getValues().forEach(v->values.put(v.getFieldKey(),Optional.ofNullable(v.getFieldValue()).orElse("")));
   var keys=completedStepSet(row); var operators=completedStepOperators(row);
   for(var index=0;index<fields.size();index++) {
     var model=fields.get(index); var label=Optional.ofNullable(model.getFieldLabel()).orElse("");
     var key=model.getFieldKey();
     if(fieldDefinition(table,key).sn() || "model".equalsIgnoreCase(key) || label.matches(".*整机\\s*型号.*")) continue;
     if(!(label.contains("型号") || key.toLowerCase(Locale.ROOT).contains("model") || key.endsWith("_info"))) continue;
     var snKeys=new ArrayList<String>();
     for(var cursor=index+1;cursor<fields.size();cursor++) {
       var candidate=fields.get(cursor); var candidateLabel=Optional.ofNullable(candidate.getFieldLabel()).orElse("");
       if(!fieldDefinition(table,candidate.getFieldKey()).sn() && (candidateLabel.contains("型号") || candidate.getFieldKey().toLowerCase(Locale.ROOT).contains("model") || candidate.getFieldKey().endsWith("_info"))) break;
       if(fieldDefinition(table,candidate.getFieldKey()).sn() && !fieldDefinition(table,candidate.getFieldKey()).machine()) snKeys.add(candidate.getFieldKey());
     }
     if(!snKeys.isEmpty() && snKeys.stream().allMatch(sn->!values.getOrDefault(sn,"").trim().isBlank())) {
       keys.add(key); operators.put(key,actor());
       var marker=row.getValues().stream().filter(v->key.equals(v.getFieldKey())).findFirst().orElseGet(()->{var v=new ScanTableValue();v.setRow(row);v.setFieldKey(key);v.setFieldValue(values.getOrDefault(key,""));row.getValues().add(v);return v;});
       marker.setOperatorNo(actor());
     }
   }
   row.setCompletedProcessKeys(String.join(",",keys));
   row.setCompletedProcessOperators(serializeStepOperators(operators));
 }
 private record DuplicateInfo(String machineSn, String fieldLabel) {}
 private DuplicateInfo findDuplicateScanValue(ScanTable current, ScanTableRow currentRow, String value) {
   var candidates = new ArrayList<>(values.findByValue(value));
   // Keep compatibility with older repository mocks/implementations while
   // the global lookup is being rolled out; production uses findByValue.
   if (candidates.isEmpty() && current.getTenant() == null) candidates.addAll(values.findByValueWithoutTenant(value));
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
   table.getTemplate().getFields().forEach(f->{if(f.isEnabled()&&!hidden.contains(f.getFieldKey())) { allowed.add(f.getFieldKey()); if(f.isRequireModel()) allowed.add(f.getFieldKey()+"__model"); }});
   if(table.getCustomFieldDefs()!=null&&!table.getCustomFieldDefs().isBlank()){
     for(var definition:customDefinitions(table)){
       var parts=definition.split("\\|",-1);
       if(parts.length>=2&&!parts[0].isBlank()&&!hidden.contains(parts[0])) allowed.add(parts[0]);
     }
   }
   return allowed;
 }
 @PostMapping("/tables/{id}/fields") @PreAuthorize("hasAuthority('PERM_ADD_PRODUCTION_COLUMN')") @Transactional public Map<String,Object> addField(@PathVariable Long id,@RequestBody CustomFieldRequest f){
   var table=tables.findById(id).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"扫码表不存在")); requireScanTableAccess(table.getTenant());
   if(f.key()==null||f.key().isBlank()||f.label()==null||f.label().isBlank())throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"列名称不能为空");
   var defs=new ArrayList<String>(customDefinitions(table));
   if(defs.stream().anyMatch(x->x.startsWith(f.key()+"|")))throw new ResponseStatusException(HttpStatus.CONFLICT,"列已存在");
   defs.add(f.key()+"|"+f.label().replace("|","/")+"|"+Optional.ofNullable(f.afterKey()).orElse("").replace("|","")+"|"+Optional.ofNullable(f.type()).orElse("TEXT")+"|"+normalizeSection(f.section(), f.key(), f.label()));
   table.setCustomFieldDefs(String.join("\n",defs));
   // Materialize the new column for existing rows as well. This keeps older
   // rows and newly opened accounts on the same schema, even when the column
   // was added after the scan table was created.
   table.getRows().forEach(row -> {
     if(row.getValues().stream().noneMatch(value -> f.key().equals(value.getFieldKey()))){
       var value=new ScanTableValue();value.setRow(row);value.setFieldKey(f.key());value.setFieldValue("");row.getValues().add(value);
     }
   });
   return tableDto(tables.save(table));
 }
 @PutMapping("/tables/{id}/rows/{rowNumber}/steps/{fieldKey}") @PreAuthorize("hasAnyAuthority('PERM_OPERATE_SCAN','PERM_CREATE_SCAN_TABLE','PERM_MANAGE_PRODUCTION')") @Transactional public Map<String,Object> toggleProcessStep(@PathVariable Long id,@PathVariable int rowNumber,@PathVariable String fieldKey,@RequestParam(defaultValue="true") boolean completed,@RequestParam(required=false) Long version){
   var table=tables.findById(id).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"扫码表不存在")); requireScanTableAccess(table.getTenant()); requireScanOperator();
   var row=table.getRows().stream().filter(x->x.getRowNumber()==rowNumber).findFirst().orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"扫码行不存在"));
   // A process may be a template field or a column added to this scan table.
   // Custom columns are persisted in customFieldDefs, so looking only at the
   // template made every newly-added SN process fail with “流程不存在”.
   var field=table.getTemplate().getFields().stream()
     .filter(f->f.isEnabled()&&f.getFieldKey().equals(fieldKey)).findFirst().orElse(null);
   if(field==null && !allowedFieldKeys(table).contains(fieldKey))
     throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"流程不存在");
   var processKey = field==null ? fieldKey : field.getFieldKey();
   var keys=new LinkedHashSet<String>(); if(row.getCompletedProcessKeys()!=null&&!row.getCompletedProcessKeys().isBlank()) keys.addAll(Arrays.asList(row.getCompletedProcessKeys().split(",")));
   var operators=completedStepOperators(row);
   if(completed){ keys.add(processKey); operators.put(processKey,actor()); }
   else { keys.remove(processKey); operators.remove(processKey); }
   // Process completion is an operator action too. Keep the actor on the
   // corresponding row value so legacy/table DTOs that expose values also
   // render the process operator without requiring a second API call.
   var processValue=row.getValues().stream().filter(v->processKey.equals(v.getFieldKey())).findFirst().orElseGet(()->{
     var value=new ScanTableValue(); value.setRow(row); value.setFieldKey(processKey); value.setFieldValue(""); row.getValues().add(value); return value;
   });
   processValue.setOperatorNo(completed?actor():"");
   row.setCompletedProcessKeys(String.join(",",keys));
   row.setCompletedProcessOperators(serializeStepOperators(operators));
   return tableDto(tables.save(table));
 }
 @GetMapping("/tables/{id}/process-steps") @Transactional public Map<Integer,Set<String>> processSteps(@PathVariable Long id){var table=tables.findById(id).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"扫码表不存在"));requireScanTableAccess(table.getTenant());return table.getRows().stream().collect(java.util.stream.Collectors.toMap(ScanTableRow::getRowNumber,this::completedStepSet));}
 @PostMapping("/tables/{id}/rows/{rowNumber}/sections/{section}/complete") @PreAuthorize("hasAnyAuthority('PERM_OPERATE_SCAN','PERM_CREATE_SCAN_TABLE','PERM_MANAGE_PRODUCTION')") @Transactional public Map<String,Object> completeSection(@PathVariable Long id,@PathVariable int rowNumber,@PathVariable String section,@RequestParam(required=false) Long version){requireScanOperator();var table=tables.findById(id).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"扫码表不存在"));requireScanTableAccess(table.getTenant());var row=table.getRows().stream().filter(x->x.getRowNumber()==rowNumber).findFirst().orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"扫码行不存在"));requireVersion(row,version);var normalized=section.replace("%20"," ");var fields=table.getTemplate().getFields().stream().filter(f->f.isEnabled()&&fieldSection(f).equals(normalized)).toList();if(fields.isEmpty())throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"该分区没有可完工流程");var missing=fields.stream().filter(ScanTemplateField::isRequired).filter(f->row.getValues().stream().noneMatch(v->f.getFieldKey().equals(v.getFieldKey())&&v.getFieldValue()!=null&&!v.getFieldValue().isBlank())).map(ScanTemplateField::getFieldLabel).toList();if(!missing.isEmpty()&&!hasAuthority("PERM_FORCE_COMPLETE_SCAN"))throw new ResponseStatusException(HttpStatus.CONFLICT,"该分区必填项尚未录入："+String.join("、",missing));var keys=new LinkedHashSet<>(completedStepSet(row));var operators=completedStepOperators(row);for(var field:fields){keys.add(field.getFieldKey());operators.put(field.getFieldKey(),actor());var value=row.getValues().stream().filter(v->field.getFieldKey().equals(v.getFieldKey())).findFirst().orElse(null);if(value!=null)value.setOperatorNo(actor());}row.setCompletedProcessKeys(String.join(",",keys));row.setCompletedProcessOperators(serializeStepOperators(operators));return tableDto(tables.save(table));}
 @PostMapping("/tables/{id}/rows/{rowNumber}/complete") @PreAuthorize("hasAnyAuthority('PERM_VIEW_PRODUCTION','PERM_CREATE_SCAN_TABLE','PERM_MANAGE_PRODUCTION')") @Transactional public Map<String,Object> completeRow(@PathVariable Long id,@PathVariable int rowNumber,@RequestParam(required=false) Long version){
   requireScanOperator();
   var table=tables.findById(id).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"扫码表不存在")); requireScanTableAccess(table.getTenant());
   var row=table.getRows().stream().filter(x->x.getRowNumber()==rowNumber).findFirst().orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"扫码行不存在"));
   requireVersion(row,version);
   if("COMPLETED".equals(row.getStatus())||"CANCELLED".equals(row.getStatus())) throw new ResponseStatusException(HttpStatus.CONFLICT,"扫码行已处于结束状态");
   var hidden=table.getHiddenFieldKeys()==null?Set.<String>of():new HashSet<>(Arrays.asList(table.getHiddenFieldKeys().split(",")));
   var required=new ArrayList<String>();
   table.getTemplate().getFields().stream().filter(f->f.isEnabled()&&!hidden.contains(f.getFieldKey())).forEach(f->{if(f.isRequired()) required.add(f.getFieldKey()); if(f.isRequireModel()) required.add(f.getFieldKey()+"__model");});
   var missing=required.stream().filter(k->{
     var field=table.getTemplate().getFields().stream().filter(f->k.equals(f.getFieldKey())).findFirst().orElse(null);
     if(field!=null&&("model".equalsIgnoreCase(k)||field.getFieldLabel().contains("整机型号")))return false;
     return row.getValues().stream().noneMatch(v->k.equals(v.getFieldKey())&&v.getFieldValue()!=null&&!v.getFieldValue().isBlank());
   }).toList();
   if(!missing.isEmpty()&&!hasAuthority("PERM_FORCE_COMPLETE_SCAN"))throw new ResponseStatusException(HttpStatus.FORBIDDEN,"必填项尚未全部录入，强制完工需 PERM_FORCE_COMPLETE_SCAN 权限："+String.join("、",missing));
   // Completing a row is the final production gate.  Every enabled,
   // visible process must first be explicitly marked complete by the
   // operator; entering a value alone is not enough.  Keep this check on the
   // server so all accounts observe the same rule and a client cannot bypass
   // it by calling the API directly.
   var completedProcesses=completedStepSet(row);
   var missingProcesses=table.getTemplate().getFields().stream()
     .filter(f->f.isEnabled()&&!hidden.contains(f.getFieldKey()))
     .filter(f->!completedProcesses.contains(f.getFieldKey()))
     .map(ScanTemplateField::getFieldLabel).toList();
   if(!missingProcesses.isEmpty()) throw new ResponseStatusException(HttpStatus.CONFLICT,"流程尚未全部完成，请先勾选："+String.join("、",missingProcesses));
   row.setStatus("COMPLETED");row.setCompletedBy(actor());row.setCompletedAt(Instant.now());if(table.getRows().stream().allMatch(x->"COMPLETED".equals(x.getStatus())||"CANCELLED".equals(x.getStatus())))table.setStatus("COMPLETED");return tableDto(tables.save(table));
 }
 /** Backward-compatible Java service entry point used by existing callers/tests. */
 public Map<String,Object> completeRow(Long id,int rowNumber){return completeRow(id,rowNumber,null);}
 @PostMapping("/tables/{id}/rows/{rowNumber}/cancel") @PreAuthorize("hasAnyAuthority('PERM_MANAGE_PRODUCTION','PERM_CREATE_SCAN_TABLE','PERM_OPERATE_SCAN')") @Transactional public Map<String,Object> cancelRow(@PathVariable Long id,@PathVariable int rowNumber,@RequestParam(required=false) Long version){var table=tables.findById(id).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"扫码表不存在"));requireScanTableAccess(table.getTenant());var row=table.getRows().stream().filter(x->x.getRowNumber()==rowNumber).findFirst().orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"扫码行不存在"));requireVersion(row,version);if("COMPLETED".equals(row.getStatus())||"CANCELLED".equals(row.getStatus()))throw new ResponseStatusException(HttpStatus.CONFLICT,"扫码行已处于结束状态");row.setStatus("CANCELLED");if(table.getRows().stream().allMatch(x->"COMPLETED".equals(x.getStatus())||"CANCELLED".equals(x.getStatus())))table.setStatus("COMPLETED");return tableDto(tables.save(table));}
 @DeleteMapping("/tables/{id}") @PreAuthorize("hasAuthority('PERM_DELETE_SCAN_TABLE')") @Transactional public void delete(@PathVariable Long id){var table=tables.findById(id).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"扫码表不存在"));requireScanTableAccess(table.getTenant());tables.delete(table);audit.record(actor(),"SCAN_TABLE_DELETE","SCAN_TABLE",String.valueOf(id),"删除扫码表",null,true);}
 @DeleteMapping("/tables/{id}/fields/{fieldKey}") @PreAuthorize("hasAuthority('PERM_DELETE_PRODUCTION_COLUMN')") @Transactional public Map<String,Object> deleteField(@PathVariable Long id,@PathVariable String fieldKey){
   var table=tables.findById(id).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"扫码表不存在")); requireScanTableAccess(table.getTenant());
   var field=table.getTemplate().getFields().stream().filter(f->fieldKey.equals(f.getFieldKey())).findFirst().orElse(null);
   if(field!=null&&("model".equalsIgnoreCase(fieldKey)||field.getFieldLabel().contains("整机型号")))throw new ResponseStatusException(HttpStatus.CONFLICT,"整机型号为系统字段，不能删除");
   var hidden=new LinkedHashSet<String>();if(table.getHiddenFieldKeys()!=null&&!table.getHiddenFieldKeys().isBlank())hidden.addAll(Arrays.asList(table.getHiddenFieldKeys().split(",")));hidden.add(fieldKey);table.setHiddenFieldKeys(String.join(",",hidden));
   table.getRows().forEach(row->row.getValues().removeIf(value->fieldKey.equals(value.getFieldKey())));
   return tableDto(tables.save(table));
 }
 private String normalizeSection(String requested,String key,String label){
   // Explicit non-default sections always win. For legacy templates created
   // before process_section was persisted, infer the two non-assembly groups
   // from their labels so old flow sheets also render hierarchically.
   if("高温间测试".equals(requested)||"包装".equals(requested)) return requested;
   var text=(String.valueOf(key)+" "+String.valueOf(label));
   if(text.contains("包装")||text.contains("打包")) return "包装";
   if(text.contains("高温")||text.contains("老化")||text.contains("测试")) return "高温间测试";
   return "组装";
 }
 private String fieldSection(ScanTemplateField f){return normalizeSection(f.getProcessSection(),f.getFieldKey(),f.getFieldLabel());}
 private Map<String,Object> templateDto(ScanTemplate t){var m=new LinkedHashMap<String,Object>();m.put("id",t.getId());m.put("customerName",t.getCustomerName());m.put("model",t.getModel());m.put("description",Optional.ofNullable(t.getDescription()).orElse(""));m.put("active",t.isActive());m.put("createdAt",t.getCreatedAt());m.put("fields",t.getFields().stream().sorted(Comparator.comparingInt(ScanTemplateField::getSortOrder)).map(f->{var x=new LinkedHashMap<String,Object>();x.put("fieldKey",f.getFieldKey());x.put("fieldLabel",f.getFieldLabel());x.put("fieldType",f.getFieldType());x.put("required",f.isRequired());x.put("enabled",f.isEnabled());x.put("scanRequired",f.isScanRequired());x.put("requireModel",f.isRequireModel());x.put("sortOrder",f.getSortOrder());x.put("section",fieldSection(f));return x;}).toList());return m;}
 private List<Map<String,Object>> tableFields(ScanTable t){var hidden=t.getHiddenFieldKeys()==null?Set.<String>of():new HashSet<>(Arrays.asList(t.getHiddenFieldKeys().split(",")));var out=new ArrayList<Map<String,Object>>();t.getTemplate().getFields().stream().filter(f->f.isEnabled()&&!hidden.contains(f.getFieldKey())).sorted(Comparator.comparingInt(ScanTemplateField::getSortOrder)).forEach(f->{var x=new LinkedHashMap<String,Object>();x.put("fieldKey",f.getFieldKey());x.put("fieldLabel",f.getFieldLabel());x.put("fieldType",f.getFieldType());x.put("required",f.isRequired());x.put("enabled",f.isEnabled());x.put("scanRequired",f.isScanRequired());x.put("requireModel",f.isRequireModel());x.put("sortOrder",f.getSortOrder());x.put("section",fieldSection(f));if(f.isRequireModel() && f.isScanRequired()) addManualModelColumn(out, f); out.add(x); if(f.isRequireModel() && !f.isScanRequired()) addManualModelColumn(out, f);});var insertPositions=new HashMap<String,Integer>();for(var d:customDefinitions(t)){var p=d.split("\\|",-1);if(p.length>=2&&!hidden.contains(p[0])){var type=p.length>=4?p[3]:(p[1].toLowerCase().contains("sn")?"SN":"TEXT");var item=new LinkedHashMap<String,Object>();item.put("fieldKey",p[0]);item.put("fieldLabel",p[1]);item.put("fieldType",type);item.put("required",false);item.put("enabled",true);item.put("scanRequired","SN".equalsIgnoreCase(type));item.put("requireModel",false);item.put("section",normalizeSection(p.length>=5?p[4]:null,p[0],p[1]));var after=p.length>=3?p[2]:"";var position=insertPositions.get(after);if(position==null){position=-1;for(var i=0;i<out.size();i++)if(after.equals(out.get(i).get("fieldKey")))position=i;}position=position<0?out.size():position+1;out.add(position,item);insertPositions.put(after,position);for(var entry:insertPositions.entrySet())if(!entry.getKey().equals(after)&&entry.getValue()>=position)entry.setValue(entry.getValue()+1);}}for(var i=0;i<out.size();i++)out.get(i).put("sortOrder",i);return out;}
 private void addManualModelColumn(List<Map<String,Object>> out, ScanTemplateField f){var model=new LinkedHashMap<String,Object>();model.put("fieldKey",f.getFieldKey()+"__model");model.put("fieldLabel",f.getFieldLabel()+" 型号");model.put("fieldType","TEXT");model.put("required",true);model.put("enabled",true);model.put("scanRequired",false);model.put("requireModel",false);model.put("sortOrder",f.getSortOrder()+0.5);model.put("section",fieldSection(f));out.add(model);}
 private Set<String> completedStepSet(ScanTableRow row){if(row.getCompletedProcessKeys()==null||row.getCompletedProcessKeys().isBlank())return Set.of();return new LinkedHashSet<>(Arrays.asList(row.getCompletedProcessKeys().split(",")));}
 private Map<String,String> completedStepOperators(ScanTableRow row){
   var result=new LinkedHashMap<String,String>();
   if(row.getCompletedProcessOperators()==null||row.getCompletedProcessOperators().isBlank()) return result;
   for(var item:row.getCompletedProcessOperators().split("\\n")){
     var pair=item.split("=",2);
     if(pair.length==2&&!pair[0].isBlank()&&!pair[1].isBlank()) result.put(pair[0],pair[1]);
   }
   return result;
 }
 private String serializeStepOperators(Map<String,String> operators){return operators.entrySet().stream().map(e->e.getKey().replace("=","_")+"="+e.getValue().replace("\n"," ").replace("=","_")).collect(java.util.stream.Collectors.joining("\n"));}
 private String machineSnForRow(ScanTableRow row){
   return Optional.ofNullable(row.getMachineSn()).map(String::trim).filter(v -> !v.isBlank()).orElseGet(() -> row.getValues().stream()
     .filter(v -> "machine_sn".equalsIgnoreCase(v.getFieldKey()) ||
       row.getScanTable().getTemplate().getFields().stream().anyMatch(f -> f.getFieldKey().equals(v.getFieldKey()) && f.getFieldLabel()!=null && f.getFieldLabel().matches(".*整机\\s*SN.*")))
     .map(ScanTableValue::getFieldValue).filter(Objects::nonNull).map(String::trim).filter(v -> !v.isBlank()).findFirst().orElse(""));
 }
 private boolean matchesMachineSn(ScanTableRow row,String target){
   if(target.equalsIgnoreCase(normalizeMachineSn(row.getMachineSn()))) return true;
   return row.getValues().stream().filter(v -> "machine_sn".equalsIgnoreCase(v.getFieldKey()) ||
       row.getScanTable().getTemplate().getFields().stream().anyMatch(f -> f.getFieldKey().equals(v.getFieldKey()) && f.getFieldLabel()!=null && f.getFieldLabel().matches(".*整机\\s*SN.*")))
     .map(ScanTableValue::getFieldValue).filter(Objects::nonNull).map(this::normalizeMachineSn)
     .anyMatch(target::equalsIgnoreCase);
 }
 private String normalizeMachineSn(String value){return Optional.ofNullable(value).orElse("").trim();}
 private Map<String,Object> rowDto(ScanTableRow r, Set<String> hidden){
   var m=new LinkedHashMap<String,Object>();
   var completedBy=Optional.ofNullable(r.getCompletedBy()).orElse("");
   var operators=completedStepOperators(r);
   r.getValues().forEach(v->{var value=Optional.ofNullable(v.getOperatorNo()).orElse("");if(!value.isBlank()&&completedStepSet(r).contains(v.getFieldKey()))operators.putIfAbsent(v.getFieldKey(),value);});
   // `completedBy` is the operator who clicked the row-level completion
   // action, not the person who scanned every field. Never fan that value
   // out to all fields; doing so made a row completed by 002 appear as if
   // 002 had scanned fields that were actually entered by 005.
   m.put("id",r.getId());m.put("rowNumber",r.getRowNumber());m.put("machineSn",machineSnForRow(r));m.put("status",r.getStatus());m.put("version",Optional.ofNullable(r.getVersion()).orElse(0L));m.put("completedSteps",completedStepSet(r));m.put("completedStepOperators",operators);m.put("processOperators",operators);m.put("completedBy",completedBy);m.put("operatorNo",completedBy);m.put("values",r.getValues().stream().filter(v->!hidden.contains(v.getFieldKey())).map(v->{var item=new LinkedHashMap<String,Object>();item.put("fieldKey",v.getFieldKey());item.put("value",Optional.ofNullable(v.getFieldValue()).orElse(""));item.put("operatorNo",Optional.ofNullable(v.getOperatorNo()).orElse(""));var field= r.getScanTable().getTemplate().getFields().stream().filter(f->f.getFieldKey().equals(v.getFieldKey())).findFirst().orElse(null);item.put("section",field==null?"组装":fieldSection(field));return item;}).toList());return m;
 }
 private Map<String,Object> completedTableDto(ScanTable t){
   var m=tableDto(t,true);
   var hidden=t.getHiddenFieldKeys()==null?Set.<String>of():new HashSet<>(Arrays.asList(t.getHiddenFieldKeys().split(",")));
   @SuppressWarnings("unchecked") var fields=(List<Map<String,Object>>)((Map<String,Object>)m.get("template")).get("fields");
   fields.forEach(field->{var key=String.valueOf(field.get("fieldKey"));var definition=t.getTemplate().getFields().stream().filter(item->item.getFieldKey().equals(key)).findFirst().orElse(null);if(definition!=null)field.put("fieldLabel",fieldSection(definition)+" · "+field.get("fieldLabel"));});
   m.put("rows",t.getRows().stream().map(r->rowDto(r,hidden)).toList());
   return m;
 }
 /** Reconcile aggregate table status without promoting a row implicitly.
  * Completing every process only records process flags. The row becomes
  * COMPLETED exclusively through the explicit row-level 完工 endpoint. */
 private void refreshAggregateStatus(ScanTable table){
   if(table.getRows().isEmpty()) return;
   if(table.getRows().stream().allMatch(row -> Set.of("COMPLETED","CANCELLED").contains(Optional.ofNullable(row.getStatus()).orElse("").toUpperCase(Locale.ROOT)))) table.setStatus("COMPLETED");
   else if(table.getRows().stream().anyMatch(row -> "IN_PROGRESS".equals(row.getStatus()) || !completedStepSet(row).isEmpty())) table.setStatus("IN_PROGRESS");
 }
 private Map<String,Object> tableDto(ScanTable t){return tableDto(t,false);}
 private Map<String,Object> tableDto(ScanTable t,boolean includeCompleted){var m=new LinkedHashMap<String,Object>();var template=templateDto(t.getTemplate());template.put("fields",tableFields(t));var hidden=t.getHiddenFieldKeys()==null?Set.<String>of():new HashSet<>(Arrays.asList(t.getHiddenFieldKeys().split(",")));m.put("id",t.getId());m.put("customerName",t.getCustomerName());m.put("model",t.getModel());m.put("dispatchOrderNo",Optional.ofNullable(t.getDispatchOrderNo()).orElse(""));m.put("disableAutoFillPartModels",t.isDisableAutoFillPartModels());m.put("quantity",t.getQuantity());m.put("status",t.getStatus());m.put("createdAt",t.getCreatedAt());m.put("template",template);m.put("rows",t.getRows().stream().filter(r->includeCompleted||(!"COMPLETED".equals(r.getStatus())&&!"CANCELLED".equals(r.getStatus()))).map(r->Map.of("id",r.getId(),"rowNumber",r.getRowNumber(),"machineSn",machineSnForRow(r),"status",r.getStatus(),"version",Optional.ofNullable(r.getVersion()).orElse(0L),"values",r.getValues().stream().filter(v->!hidden.contains(v.getFieldKey())).map(v->Map.of("fieldKey",v.getFieldKey(),"value",Optional.ofNullable(v.getFieldValue()).orElse(""),"operatorNo",Optional.ofNullable(v.getOperatorNo()).orElse(""))).toList())).toList());return m;}
 private void requireVersion(ScanTableRow row, Long expected){if(expected!=null&&!Objects.equals(expected,row.getVersion()))throw new ResponseStatusException(HttpStatus.CONFLICT,"扫码行已被其他用户修改，请刷新后重试");}
 private void requireFieldVersion(ScanTableRow row, Long expected, List<Value> submitted){
   if(expected==null||Objects.equals(expected,row.getVersion())) return;
   var current=new HashMap<String,String>();
   row.getValues().forEach(v->current.put(v.getFieldKey(),Optional.ofNullable(v.getFieldValue()).orElse("").trim()));
   for(var value:Optional.ofNullable(submitted).orElseGet(List::of)){
     if(value==null||value.fieldKey()==null||value.fieldKey().isBlank()) continue;
     var incoming=Optional.ofNullable(value.value()).orElse("").trim();
     var existing=current.getOrDefault(value.fieldKey(),"");
     if(!existing.isBlank()&&!existing.equals(incoming))
       throw new ResponseStatusException(HttpStatus.CONFLICT,"扫码字段「"+fieldDefinition(row.getScanTable(),value.fieldKey()).label()+"」已被其他用户修改，请刷新后重试");
   }
 }
 private Map<String,Object> pageDto(List<?> content,int page,int size,long total,int pages){var m=new LinkedHashMap<String,Object>();m.put("content",content);m.put("page",page);m.put("size",size);m.put("totalElements",total);m.put("totalPages",pages);return m;}
}
