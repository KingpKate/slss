package com.slss.api;
import com.slss.domain.LifecycleEvent;
import com.slss.domain.ScanTemplateField;
import com.slss.repository.*; import com.slss.service.AuditService; import com.slss.service.TenantScopeService; import org.springframework.web.bind.annotation.*;
import org.springframework.data.domain.*;
import org.springframework.security.access.prepost.PreAuthorize; import org.springframework.security.core.context.SecurityContextHolder;
@RestController @RequestMapping("/api/v1/assets") public class AssetController {
 private final AssetRepository repo; private final AssetComponentRepository components; private final LifecycleEventRepository lifecycle; private final ScanTableRepository scanTables; private final AuditService audit; private final TenantScopeService tenantScope;
 public AssetController(AssetRepository repo,AssetComponentRepository components,LifecycleEventRepository lifecycle,ScanTableRepository scanTables,AuditService audit,TenantScopeService tenantScope){this.repo=repo;this.components=components;this.lifecycle=lifecycle;this.scanTables=scanTables;this.audit=audit;this.tenantScope=tenantScope;}
 private void requireAssetAccess(com.slss.domain.Asset asset){ tenantScope.requireAccess(asset==null||asset.getBatch()==null?asset==null?null:asset.getTenant():asset.getBatch().getTenant()); }
 private boolean canAccessTable(com.slss.domain.ScanTable table){ return tenantScope.canAccess(table.getTenant()); }
 public record ComponentResponse(String type,String model,String serialNo,String operatorNo,String faultDescription,String fieldKey){}
 public record ForceComponentRequest(String type,String model,String serialNo,String faultDescription,String fieldKey){}
 public record ForceScanRequest(java.util.List<ForceComponentRequest> components){}
 public record ForceColumnRequest(String label,String type,String afterType,Integer occurrence,Boolean inheritLabel,String fieldKey,String position){}
 public record AssetResponse(Long id,String machineSn,String contractNo,java.time.LocalDate invoiceDate,String model,String batchName,java.time.Instant batchCreatedAt,java.util.List<ComponentResponse> components,Long scanTableId,Integer scanRowNumber){}
 private record FieldDef(String key,String label,String model){ FieldDef(String key,String label){this(key,label,"");} }
 private java.util.List<String> customDefinitions(com.slss.domain.ScanTable table){
  var raw=java.util.Optional.ofNullable(table.getCustomFieldDefs()).orElse("");
  // Older rows were written with the two characters "\\n" instead of a
  // real line break. Accept both formats so legacy production tables remain
  // editable and new definitions are always parsed independently.
  return java.util.Arrays.stream(raw.replace("\\n","\n").split("\\R"))
    .map(String::trim).filter(x->!x.isBlank()).toList();
 }
 private java.util.List<FieldDef> orderedFields(com.slss.domain.ScanTable table){
  var hidden=table.getHiddenFieldKeys()==null?java.util.Set.<String>of():new java.util.HashSet<>(java.util.Arrays.asList(table.getHiddenFieldKeys().split(",")));
  var fields=new java.util.ArrayList<FieldDef>();
  table.getTemplate().getFields().stream().filter(f->!hidden.contains(f.getFieldKey())).sorted(java.util.Comparator.comparingInt(ScanTemplateField::getSortOrder)).forEach(f->fields.add(new FieldDef(f.getFieldKey(),f.getFieldLabel())));
  for(var definition:customDefinitions(table)){
   var parts=definition.split("\\|",-1);if(parts.length<2||hidden.contains(parts[0]))continue;
   var after=parts.length>=3?parts[2]:"";var position=-1;for(var i=0;i<fields.size();i++)if(after.equals(fields.get(i).key()))position=i;
   fields.add(position>=0?position+1:fields.size(),new FieldDef(parts[0],parts[1],parts.length>=6?parts[5]:""));
  }
  return fields;
 }
 private String machineSnForRow(com.slss.domain.ScanTable table,com.slss.domain.ScanTableRow row){
  var direct=java.util.Optional.ofNullable(row.getMachineSn()).map(String::trim).filter(x->!x.isBlank());
  if(direct.isPresent()) return direct.get();
  var defs=orderedFields(table);
  return defs.stream().filter(d->"machine_sn".equalsIgnoreCase(d.key())||d.label().matches(".*整机\\s*SN.*"))
    // JPA rows may contain a value record whose fieldValue is still null.
    // Stream.findFirst() rejects null elements, which previously made the
    // force-column endpoint fail with a 500 before it could add the row.
    .map(d->row.getValues().stream()
      .filter(v->d.key().equals(v.getFieldKey()))
      .map(com.slss.domain.ScanTableValue::getFieldValue)
      .map(x->java.util.Optional.ofNullable(x).orElse(""))
      .findFirst().orElse(""))
    .map(x->java.util.Optional.ofNullable(x).orElse("").trim()).filter(x->!x.isBlank()).findFirst().orElse("");
 }
 private String normalizedLabel(String value){
  return java.util.Optional.ofNullable(value).orElse("").replaceAll("\\s+", "").trim().toLowerCase(java.util.Locale.ROOT);
 }
 private java.util.Optional<com.slss.domain.ScanTableValue> scanValueFor(String machineSn,String partType){
  if(partType==null||partType.isBlank()) return java.util.Optional.empty();
  for(var table:scanTables.findAll()) { if(!canAccessTable(table)) continue; for(var row:table.getRows()){
   var machine=machineSnForRow(table,row);
   if(!machineSn.trim().equalsIgnoreCase(machine)) continue;
   var defs=orderedFields(table);
   for(var def:defs) if(partType.equalsIgnoreCase(def.label())) return row.getValues().stream().filter(v->def.key().equals(v.getFieldKey())).findFirst();
  }}
  return java.util.Optional.empty();
 }
 private java.util.Optional<com.slss.domain.ScanTableValue> scanModelValueFor(String machineSn,String partType){
  if(partType==null||partType.isBlank()) return java.util.Optional.empty();
  for(var table:scanTables.findAll()) { if(!canAccessTable(table)) continue; for(var row:table.getRows()){
   var machine=machineSnForRow(table,row);
   if(!machineSn.trim().equalsIgnoreCase(machine)) continue;
   var defs=orderedFields(table); for(var index=0;index<defs.size();index++) if(partType.equalsIgnoreCase(defs.get(index).label())||partType.equalsIgnoreCase(defs.get(index).key())){
    for(var cursor=index-1;cursor>=0;cursor--){var candidate=defs.get(cursor);if(candidate.label().contains("型号")||candidate.key().toLowerCase(java.util.Locale.ROOT).contains("model")||candidate.key().endsWith("_info")) return row.getValues().stream().filter(v->candidate.key().equals(v.getFieldKey())).findFirst();}
   }
  }}
  return java.util.Optional.empty();
 }
 private String componentKey(String value){
  if(value==null)return "";
  return value.toLowerCase(java.util.Locale.ROOT).replaceAll("sn|序列号|型号|[^a-z0-9\\u4e00-\\u9fff]","");
 }
 private AssetResponse dto(com.slss.domain.Asset a){ return dto(a,false); }
 private AssetResponse dto(com.slss.domain.Asset a, boolean includeCustomFields){
  var result=new java.util.ArrayList<ComponentResponse>();
  var existing=new java.util.HashSet<String>();
  scanTables.findAll().stream().filter(this::canAccessTable).filter(t->t.getRows().stream().anyMatch(r->r.getValues().stream().anyMatch(v->"machine_sn".equalsIgnoreCase(v.getFieldKey())&&a.getMachineSn().equalsIgnoreCase(v.getFieldValue())))).findFirst().ifPresent(t->{
   var row=t.getRows().stream().filter(r->r.getValues().stream().anyMatch(v->"machine_sn".equalsIgnoreCase(v.getFieldKey())&&a.getMachineSn().equalsIgnoreCase(v.getFieldValue()))).findFirst().orElse(null);
   if(row!=null) {
    var values=new java.util.HashMap<String,String>();var operators=new java.util.HashMap<String,String>();row.getValues().forEach(v->{values.put(v.getFieldKey(),v.getFieldValue());operators.put(v.getFieldKey(),v.getOperatorNo());});
    var fields=orderedFields(t);
    for(var index=0;index<fields.size();index++){
     var field=fields.get(index);var serial=values.get(field.key());
     var isSn=!"machine_sn".equalsIgnoreCase(field.key())&&(field.key().toLowerCase(java.util.Locale.ROOT).contains("sn")||field.label().toLowerCase(java.util.Locale.ROOT).matches(".*(sn|序列号).*"));
     var isCustom=field.key().startsWith("force_");
     if((!isSn&&!isCustom)||(!includeCustomFields&&(serial==null||serial.isBlank()))||(serial!=null&&!serial.isBlank()&&existing.contains(serial.toLowerCase(java.util.Locale.ROOT))))continue;
     var model=field.model();
     if(model.isBlank()&&!isCustom) for(var cursor=index-1;cursor>=0;cursor--){var candidate=fields.get(cursor);if(candidate.label().contains("型号")||candidate.key().toLowerCase(java.util.Locale.ROOT).contains("model")||candidate.key().endsWith("_info")){model=java.util.Optional.ofNullable(values.get(candidate.key())).orElse("");break;}}
     result.add(new ComponentResponse(field.label(),model,serial,operators.get(field.key()),null,field.key()));existing.add(serial.toLowerCase(java.util.Locale.ROOT));
    }
   }
  });
  components.findByAssetIdOrderById(a.getId()).forEach(c->{
   var key=componentKey(c.getComponentType());
   for(var i=0;i<result.size();i++) if(componentKey(result.get(i).type()).equals(key)&&!key.isBlank()){
    var previous=result.get(i); result.set(i,new ComponentResponse(c.getComponentType(),c.getModel(),c.getSerialNo(),previous.operatorNo(),c.getFaultDescription(),previous.fieldKey()));
    existing.add(c.getSerialNo().toLowerCase(java.util.Locale.ROOT)); return;
   }
   if(existing.add(c.getSerialNo().toLowerCase(java.util.Locale.ROOT)))result.add(new ComponentResponse(c.getComponentType(),c.getModel(),c.getSerialNo(),null,c.getFaultDescription(),""));
  });
  Long sourceTableId=null; Integer sourceRowNumber=null;
  outer: for(var table:scanTables.findAll()) { if(!canAccessTable(table)) continue; for(var row:table.getRows()) {
    var machine=java.util.Optional.ofNullable(row.getMachineSn()).orElseGet(()->row.getValues().stream().filter(v->"machine_sn".equalsIgnoreCase(v.getFieldKey())).map(com.slss.domain.ScanTableValue::getFieldValue).filter(x->x!=null&&!x.isBlank()).findFirst().orElse(""));
    if(a.getMachineSn()!=null&&a.getMachineSn().equalsIgnoreCase(machine)){sourceTableId=table.getId();sourceRowNumber=row.getRowNumber();break outer;}
  }}
  return new AssetResponse(a.getId(),a.getMachineSn(),a.getContractNo(),a.getInvoiceDate(),a.getModel(),a.getBatch()==null?null:a.getBatch().getBatchName(),a.getBatch()==null?null:a.getBatch().getCreatedAt(),result,sourceTableId,sourceRowNumber);
 }
 @GetMapping @PreAuthorize("hasAnyAuthority('PERM_VIEW_PRODUCTION','PERM_MANAGE_PRODUCTION')") @org.springframework.transaction.annotation.Transactional(readOnly=true) public Object list(){return repo.findAll().stream().filter(a->{try{requireAssetAccess(a);return true;}catch(org.springframework.web.server.ResponseStatusException e){return false;}}).map(this::dto).toList();}
 @GetMapping("/page") @PreAuthorize("hasAnyAuthority('PERM_VIEW_PRODUCTION','PERM_MANAGE_PRODUCTION')") @org.springframework.transaction.annotation.Transactional(readOnly=true)
 public PageResponse<AssetResponse> page(@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="50") int size){
  var pageable=PageRequest.of(Math.max(0,page),Math.min(Math.max(1,size),200),Sort.by(Sort.Direction.DESC,"id"));
  var ids=tenantScope.currentTenantIds();
  var result=tenantScope.isSystemAdmin()?repo.findAll(pageable):(ids.isEmpty()?repo.findByTenantIsNull(pageable):repo.findByTenant_IdIn(ids,pageable));
  return PageResponse.of(result.map(this::dto));
 }
 @GetMapping("/{machineSn}") @PreAuthorize("hasAnyAuthority('PERM_VIEW_PRODUCTION','PERM_MANAGE_PRODUCTION','PERM_MANAGE_PRODUCTION_REPAIR','PERM_FORCE_EDIT_COMPLETED_SCAN')") @org.springframework.transaction.annotation.Transactional(readOnly=true) public Object get(@PathVariable String machineSn){
  // A legacy Asset can have a null/old tenant while its authoritative scan
  // row is already attached to the current tenant. Do not fail early on the
  // legacy projection; fall through to repairLookup so completed MES rows
  // remain searchable for repair operators.
  var existing=repo.findByMachineSnIgnoreCase(machineSn).filter(a->tenantScope.canAccess(a==null||a.getBatch()==null?a==null?null:a.getTenant():a.getBatch().getTenant()));
  return existing.<Object>map(a -> dto(a,false)).orElseGet(() -> repairLookup(machineSn));
 }
 private Object repairLookup(String serialNo){ return repairLookup(serialNo,false); }
 @GetMapping("/repair-lookup/{serialNo}")
 @PreAuthorize("hasAnyAuthority('PERM_VIEW_PRODUCTION','PERM_MANAGE_PRODUCTION','PERM_MANAGE_PRODUCTION_REPAIR','PERM_FORCE_EDIT_COMPLETED_SCAN')")
 @org.springframework.transaction.annotation.Transactional(readOnly=true)
 public Object repairLookup(@PathVariable String serialNo,@RequestParam(defaultValue="false") boolean includeCustomFields){
  var value=java.util.Optional.ofNullable(serialNo).orElse("").trim();
  if(value.isBlank()) throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST,"SN 不能为空");
  var existing=repo.findByMachineSnIgnoreCase(value).filter(a->tenantScope.canAccess(a==null||a.getBatch()==null?a==null?null:a.getTenant():a.getBatch().getTenant()));
  if(existing.isPresent()) return dto(existing.get(),includeCustomFields);
  for(var table:scanTables.findAll()){ if(!canAccessTable(table)) continue;
   for(var row:table.getRows()){
    var defs=orderedFields(table);
    var values=new java.util.HashMap<String,String>();var operators=new java.util.HashMap<String,String>();
    row.getValues().forEach(v->{values.put(v.getFieldKey(),v.getFieldValue());operators.put(v.getFieldKey(),v.getOperatorNo());});
    var machine=java.util.Optional.ofNullable(row.getMachineSn()).filter(x->!x.isBlank()).orElseGet(()->defs.stream().filter(d->"machine_sn".equalsIgnoreCase(d.key())||d.label().matches(".*整机.*SN.*")).map(d->values.get(d.key())).filter(x->x!=null&&!x.isBlank()).findFirst().orElse(""));
    var matched=values.entrySet().stream().anyMatch(e->value.equalsIgnoreCase(java.util.Optional.ofNullable(e.getValue()).orElse("").trim()));
    // A historical scan row can contain component SNs before the machine SN
    // was entered. It is still a valid read-only lookup result; do not drop
    // it merely because machine is blank.
    if(!matched) continue;
    var result=new java.util.ArrayList<ComponentResponse>();var seen=new java.util.HashSet<String>();
    for(var index=0;index<defs.size();index++){
     var field=defs.get(index);var serial=values.get(field.key());
     var isMachine="machine_sn".equalsIgnoreCase(field.key())||field.label().matches(".*整机.*SN.*");
     var isSn=!isMachine&&(field.key().toLowerCase(java.util.Locale.ROOT).contains("sn")||field.label().toLowerCase(java.util.Locale.ROOT).matches(".*(sn|序列号).*"));
     // Repair lookup keeps its historical SN-only projection.  Force-edit
     // lookup additionally returns custom rows, including blank rows just
     // added by the administrator; otherwise the subsequent refresh would
     // overwrite the optimistic row and make it appear to disappear.
     if(!isSn && !(includeCustomFields && field.key().startsWith("force_"))) continue;
     if(!includeCustomFields && (serial==null||serial.isBlank())) continue;
     if(serial!=null&&!serial.isBlank()&&!seen.add(serial.toLowerCase(java.util.Locale.ROOT))) continue;
     var model=field.model();
     // Administrator-added force rows are independent physical rows.  Do not
     // infer a model from the preceding field (for example WD 4T from a hard
     // disk/model column), otherwise a blank row appears to be a duplicate
     // hard-disk entry in the force-edit screen.
     if(model.isBlank()&&!field.key().startsWith("force_")) for(var cursor=index-1;cursor>=0;cursor--){var candidate=defs.get(cursor);if(candidate.label().contains("型号")||candidate.key().toLowerCase(java.util.Locale.ROOT).contains("model")||candidate.key().endsWith("_info")){model=java.util.Optional.ofNullable(values.get(candidate.key())).orElse("");break;}}
     result.add(new ComponentResponse(field.label(),model,serial,operators.get(field.key()),null,field.key()));
    }
    // Component-SN lookup must remain usable even when the legacy row has no
    // machine SN yet. Use the searched SN as the stable lookup key while
    // preserving the full row projection; this avoids falsely reporting
    // “not found” for valid scan data.
    var response=new java.util.LinkedHashMap<String,Object>();response.put("id",null);response.put("machineSn",machine.isBlank()?value:machine);response.put("lookupSerialNo",value);response.put("contractNo","");response.put("invoiceDate",null);response.put("model",table.getModel());response.put("batchName",table.getCustomerName()+" / "+table.getModel());response.put("batchCreatedAt",table.getCreatedAt());response.put("components",result);response.put("scanOnly",true);response.put("scanTableId",table.getId());response.put("rowNumber",row.getRowNumber());return response;
   }
  }
  throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.NOT_FOUND,"未找到该整机或配件 SN 的生产扫码数据");
 }
 @PutMapping("/{machineSn}/force-scan") @PreAuthorize("hasAnyAuthority('PERM_MANAGE_PRODUCTION_REPAIR','PERM_MANAGE_PRODUCTION','PERM_FORCE_EDIT_COMPLETED_SCAN')") @org.springframework.transaction.annotation.Transactional
 public Object forceScan(@PathVariable String machineSn,@RequestBody ForceScanRequest request,java.security.Principal principal){
  var assetOpt=repo.findByMachineSnIgnoreCase(machineSn);
  // Devices created in MES can exist only in scan_table_rows until a legacy
  // production asset is imported. They are still valid repair targets.
  if(assetOpt.isEmpty()){
   var target=java.util.Optional.<com.slss.domain.ScanTable>empty(); com.slss.domain.ScanTableRow targetRow=null; String resolvedMachine="";
   outer: for(var table:scanTables.findAll()) { if(!canAccessTable(table)) continue; for(var row:table.getRows()){
    var machine=java.util.Optional.ofNullable(row.getMachineSn()).filter(x->!x.isBlank()).orElseGet(()->row.getValues().stream().filter(v->"machine_sn".equalsIgnoreCase(v.getFieldKey())).map(com.slss.domain.ScanTableValue::getFieldValue).filter(x->x!=null&&!x.isBlank()).findFirst().orElse(""));
    var matchesMachine=machineSn.trim().equalsIgnoreCase(machine);
    var matchesComponent=row.getValues().stream().anyMatch(v->machineSn.trim().equalsIgnoreCase(java.util.Optional.ofNullable(v.getFieldValue()).orElse("").trim()));
    if(matchesMachine||matchesComponent){target=java.util.Optional.of(table);targetRow=row;resolvedMachine=machine;break outer;}
   }}
   if(target.isEmpty()||targetRow==null) throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.NOT_FOUND,"未找到整机 SN");
   if(resolvedMachine.isBlank()) throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.CONFLICT,"该扫码行尚未录入整机 SN，无法执行完工数据修改，请先录入整机 SN");
   var table=target.get();var defs=orderedFields(table);
   // A stale client may optimistically render a newly added row before the
   // add-column request is committed. Reconcile that row during save so the
   // save operation itself is sufficient to create the custom definition.
   if(request.components()!=null){
    var reconciledDefinitions=new java.util.ArrayList<String>(customDefinitions(table)); boolean createdDefinition=false;
    for(var change:request.components()) if(change!=null&&change.fieldKey()!=null&&change.fieldKey().startsWith("force_")){
     var requestedCustomKey=change.fieldKey().trim();
     if(reconciledDefinitions.stream().anyMatch(line->line.startsWith(requestedCustomKey+"|"))) continue;
     var safeLabel=java.util.Optional.ofNullable(change.type()).filter(x->!x.isBlank()).orElse("未命名配件").trim().replace("|","/");
     var safeModel=java.util.Optional.ofNullable(change.model()).orElse("").trim().replace("|","/");
     reconciledDefinitions.add(requestedCustomKey+"|"+safeLabel+"||SN|组装|"+safeModel); createdDefinition=true;
    }
    if(createdDefinition){table.setCustomFieldDefs(String.join("\n",reconciledDefinitions));defs=orderedFields(table);}
   }
   // Persist names entered for administrator-added rows.  The field key is
   // stable, while the display name is intentionally editable/blank at
   // creation time.
   if(request.components()!=null && table.getCustomFieldDefs()!=null){
    var definitions=new java.util.ArrayList<String>(customDefinitions(table)); boolean renamed=false;
    for(var change:request.components()) if(change!=null && change.fieldKey()!=null && change.fieldKey().startsWith("force_") && change.type()!=null && !change.type().isBlank()){
     for(var i=0;i<definitions.size();i++){var parts=definitions.get(i).split("\\|",-1);if(parts.length>=2&&change.fieldKey().equals(parts[0])){parts[1]=change.type().trim().replace("|","/");if(change.model()!=null&&!change.model().isBlank()){if(parts.length<6) parts=java.util.Arrays.copyOf(parts,6);parts[5]=change.model().trim().replace("|","/");}definitions.set(i,String.join("|",parts));renamed=true;break;}}
    }
    if(renamed) table.setCustomFieldDefs(String.join("\n",definitions));
   }
   tenantScope.requireAccess(table.getTenant());
   var asset=new com.slss.domain.Asset();asset.setMachineSn(resolvedMachine.trim());asset.setModel(table.getModel());asset.setTenant(table.getTenant());asset=repo.save(asset);
   for(var change:request.components()==null?java.util.List.<ForceComponentRequest>of():request.components()){
    // Custom force rows are persisted directly by their immutable key.  This
    // path intentionally does not depend on the editable display name and
    // also permits clearing/replacing the row without touching any standard
    // template field.
    if(change!=null&&change.fieldKey()!=null&&change.fieldKey().startsWith("force_")){
     var customKey=change.fieldKey().trim();
     var customValue=targetRow.getValues().stream().filter(v->customKey.equals(v.getFieldKey())).findFirst().orElse(null);
     if(customValue==null){customValue=new com.slss.domain.ScanTableValue();customValue.setRow(targetRow);customValue.setFieldKey(customKey);targetRow.getValues().add(customValue);}
     customValue.setFieldValue(java.util.Optional.ofNullable(change.serialNo()).orElse("").trim());
     customValue.setOperatorNo(principal==null?actor():principal.getName());
     customValue.setScannedAt(java.time.Instant.now());
     continue;
    }
    if(change==null||change.serialNo()==null||change.serialNo().isBlank())continue;
    var requestedKey=java.util.Optional.ofNullable(change.fieldKey()).orElse("").trim();
    var changeType=java.util.Optional.ofNullable(change.type()).orElse("");
    FieldDef def=null;
    for(var candidate:defs) if(!requestedKey.isBlank()&&candidate.key().equalsIgnoreCase(requestedKey)){def=candidate;break;}
    if(def==null) for(var candidate:defs) if(candidate.label().equalsIgnoreCase(changeType)||candidate.key().equalsIgnoreCase(changeType)){def=candidate;break;}
    if(def==null && !requestedKey.startsWith("force_")) continue;
    // A custom row is identified by its immutable field key.  Keep a
    // defensive fallback here so older clients that send a renamed label (or
    // a response with stale definitions) still persist the value instead of
    // silently dropping it.
    if(def==null) def=new FieldDef(requestedKey,java.util.Optional.ofNullable(change.type()).orElse("未命名配件"));
    var persistedKey=def.key();
    var value=targetRow.getValues().stream().filter(v->persistedKey.equals(v.getFieldKey())).findFirst().orElse(null);
    if(value==null){value=new com.slss.domain.ScanTableValue();value.setRow(targetRow);value.setFieldKey(persistedKey);targetRow.getValues().add(value);}
    var oldSn=java.util.Optional.ofNullable(value.getFieldValue()).orElse("").trim();var newSn=change.serialNo().trim();
    if(!oldSn.equalsIgnoreCase(newSn)){
     if(change.faultDescription()==null||change.faultDescription().isBlank()) throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST,"配件 "+change.type()+" 更换时必须填写故障描述");
     var duplicate=components.findBySerialNoIgnoreCase(newSn);if(duplicate.isPresent()&&!duplicate.get().getAsset().getId().equals(asset.getId())&&!hasAuthority("PERM_FORCE_DUPLICATE_SN"))throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.CONFLICT,"配件 SN "+newSn+" 已存在于其他设备；需要勾选“强制重复使用 SN”权限");
     var component=new com.slss.domain.AssetComponent();component.setAsset(asset);component.setComponentType(change.type()==null?def.label():change.type().trim());component.setModel(change.model());component.setSerialNo(newSn);component.setFaultDescription(change.faultDescription().trim());components.save(component);
     var event=new LifecycleEvent();event.setAsset(asset);event.setEventType("REPAIR_SWAP");event.setPartName(change.type()==null?def.label():change.type().trim());event.setOldSn(oldSn);event.setNewSn(newSn);event.setFaultDescription(change.faultDescription().trim());event.setDetails("生产维修更换配件，维修员："+(principal==null?actor():principal.getName()));lifecycle.save(event);
    }
    value.setFieldValue(newSn);value.setOperatorNo(principal==null?actor():principal.getName());value.setScannedAt(java.time.Instant.now());
   }
   scanTables.save(table);audit.record(actor(),"ASSET_FORCE_SCAN","SCAN_TABLE",String.valueOf(table.getId()),"生产维修更新扫码表配件",null,true);return repairLookup(resolvedMachine,true);
  }
  var asset=assetOpt.get(); requireAssetAccess(asset);
  // A force-edit save may arrive immediately after the UI added a custom row.
  // Reconcile the definition and the row value here as well, so persistence
  // does not depend on a preceding add-column request winning a race.
  var forceTables=scanTables.findAll().stream().filter(this::canAccessTable)
   .filter(t->t.getRows().stream().anyMatch(r->asset.getMachineSn().equalsIgnoreCase(machineSnForRow(t,r)))).toList();
  for(var table:forceTables){
   var definitions=new java.util.ArrayList<String>(customDefinitions(table)); boolean changed=false;
   for(var change:request.components()==null?java.util.List.<ForceComponentRequest>of():request.components()){
    if(change==null||change.fieldKey()==null||!change.fieldKey().startsWith("force_")) continue;
    var key=change.fieldKey().trim();
    if(definitions.stream().noneMatch(line->line.startsWith(key+"|"))){
     var label=java.util.Optional.ofNullable(change.type()).filter(x->!x.isBlank()).orElse("未命名配件").trim().replace("|","/");
     var model=java.util.Optional.ofNullable(change.model()).orElse("").trim().replace("|","/");
     definitions.add(key+"|"+label+"||SN|组装|"+model); changed=true;
    }
    for(var row:table.getRows()) if(asset.getMachineSn().equalsIgnoreCase(machineSnForRow(table,row))
      && row.getValues().stream().noneMatch(v->key.equals(v.getFieldKey()))){
      var value=new com.slss.domain.ScanTableValue(); value.setRow(row); value.setFieldKey(key); value.setFieldValue(""); row.getValues().add(value); changed=true;
    }
   }
   if(changed){ table.setCustomFieldDefs(String.join("\n",definitions)); scanTables.save(table); }
  }
  for(var row:request.components()==null?java.util.List.<ForceComponentRequest>of():request.components()){
   if(row!=null&&row.fieldKey()!=null&&row.fieldKey().startsWith("force_")){
    var customKey=row.fieldKey().trim();
    var customValue=scanTables.findAll().stream().filter(this::canAccessTable).flatMap(t->t.getRows().stream().map(scanRow->java.util.Map.entry(t,scanRow))).filter(entry->asset.getMachineSn().equalsIgnoreCase(machineSnForRow(entry.getKey(),entry.getValue()))).flatMap(entry->entry.getValue().getValues().stream()).filter(v->customKey.equals(v.getFieldKey())).findFirst().orElse(null);
    if(customValue!=null){customValue.setFieldValue(java.util.Optional.ofNullable(row.serialNo()).orElse("").trim());customValue.setOperatorNo(principal==null?actor():principal.getName());customValue.setScannedAt(java.time.Instant.now());}
    continue;
   }
   if(row.type()==null||row.type().isBlank()||row.serialNo()==null||row.serialNo().isBlank())continue;
   var duplicate=components.findBySerialNoIgnoreCase(row.serialNo().trim());
   if(duplicate.isPresent()&&!duplicate.get().getAsset().getId().equals(asset.getId())&&!hasAuthority("PERM_FORCE_DUPLICATE_SN"))throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.CONFLICT,"配件 SN "+row.serialNo()+" 已存在于设备 "+duplicate.get().getAsset().getMachineSn()+" 的 "+duplicate.get().getComponentType()+"；需要勾选“强制重复使用 SN”权限");
   // 同一整机的已有 SN 直接复用原记录，避免因扫码表字段标签与资产组件类型不同而重复插入。
   var component=duplicate.filter(c->c.getAsset().getId().equals(asset.getId())).orElseGet(()->components.findByAssetIdAndComponentType(asset.getId(),row.type()).orElseGet(com.slss.domain.AssetComponent::new));
   var originalScanValue=java.util.Optional.<com.slss.domain.ScanTableValue>empty();
   if(row.fieldKey()!=null&&!row.fieldKey().isBlank()&&row.fieldKey().startsWith("force_")) for(var table:scanTables.findAll()) for(var scanRow:table.getRows()) if(asset.getMachineSn().equalsIgnoreCase(machineSnForRow(table,scanRow))) { originalScanValue=scanRow.getValues().stream().filter(v->row.fieldKey().equals(v.getFieldKey())).findFirst(); if(originalScanValue.isPresent()) break; }
   if(originalScanValue.isEmpty()) originalScanValue=scanValueFor(asset.getMachineSn(),row.type());
   var newSn=row.serialNo().trim();
   var scanOld=originalScanValue.map(com.slss.domain.ScanTableValue::getFieldValue).filter(v->v!=null&&!v.isBlank()&&!v.equalsIgnoreCase(newSn)).orElse(null);
   var oldSn=scanOld!=null?scanOld:(component.getId()==null?null:component.getSerialNo());
   var changed=oldSn==null||!oldSn.equalsIgnoreCase(newSn);
   if(changed&&(row.faultDescription()==null||row.faultDescription().isBlank())) throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST,"配件 "+row.type()+" 更换时必须填写故障描述");
   component.setAsset(asset);component.setComponentType(row.type().trim());component.setModel(row.model());component.setSerialNo(row.serialNo().trim());components.save(component);
   component.setFaultDescription(row.faultDescription()==null?component.getFaultDescription():row.faultDescription().trim());
   originalScanValue.ifPresent(v->{v.setFieldValue(newSn);v.setOperatorNo(principal==null?null:principal.getName());v.setScannedAt(java.time.Instant.now());});
   scanModelValueFor(asset.getMachineSn(),row.type()).ifPresent(v->{v.setFieldValue(java.util.Optional.ofNullable(row.model()).orElse("").trim());v.setOperatorNo(principal==null?null:principal.getName());v.setScannedAt(java.time.Instant.now());});
   if(oldSn!=null&&!oldSn.isBlank()&&!oldSn.equalsIgnoreCase(newSn)){
    var event=new LifecycleEvent();event.setAsset(asset);event.setEventType("REPAIR_SWAP");event.setPartName(row.type().trim());event.setOldSn(oldSn);event.setNewSn(newSn);event.setFaultDescription(row.faultDescription().trim());event.setDetails("生产维修更换配件，维修员："+(principal==null?"未知":principal.getName()));lifecycle.save(event);
   }
  }
  audit.record(actor(),"ASSET_FORCE_SCAN","ASSET",machineSn,"强制更换配件",null,true);
  return dto(asset,true);
 }
 @PostMapping("/{machineSn}/force-column")
 @PreAuthorize("hasAnyAuthority('PERM_FORCE_EDIT_COMPLETED_SCAN','PERM_MANAGE_PRODUCTION','PERM_MANAGE_PRODUCTION_REPAIR')")
 @org.springframework.transaction.annotation.Transactional
 public Object forceAddColumn(@PathVariable String machineSn,@RequestBody ForceColumnRequest request){
  var targetMachineSn=java.util.Optional.ofNullable(machineSn).orElse("").trim();
  var label=java.util.Optional.ofNullable(request==null?null:request.label()).orElse("").trim();
  if(label.isBlank()) throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST,"新增列名称不能为空");
  com.slss.domain.ScanTable target=null; com.slss.domain.ScanTableRow targetRow=null;
  outer: for(var table:scanTables.findAll()){ if(!canAccessTable(table)) continue; for(var row:table.getRows()){
    var machine=machineSnForRow(table,row);
    var fallback=row.getValues().stream().map(com.slss.domain.ScanTableValue::getFieldValue).filter(java.util.Objects::nonNull).map(String::trim).anyMatch(v->targetMachineSn.equalsIgnoreCase(v));
    if(targetMachineSn.equalsIgnoreCase(machine)||fallback){target=table;targetRow=row;break outer;}
  }}
  if(target==null||targetRow==null) throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.NOT_FOUND,"未找到整机 SN 对应的扫码表");
  tenantScope.requireAccess(target.getTenant());
  var type=java.util.Optional.ofNullable(request.type()).filter(x->!x.isBlank()).orElse("SN").toUpperCase(java.util.Locale.ROOT);
  var key="force_"+label.toLowerCase(java.util.Locale.ROOT).replaceAll("[^a-z0-9\\u4e00-\\u9fff]+","_")+"_"+System.currentTimeMillis();
  var afterType=java.util.Optional.ofNullable(request.afterType()).orElse("").trim();
  var afterKey="";
  for(var def:orderedFields(target)) if(normalizedLabel(def.label()).equals(normalizedLabel(afterType))||def.key().equalsIgnoreCase(afterType)) {afterKey=def.key();break;}
  // force-column rows can themselves be custom fields. Resolve the anchor
  // from the persisted custom definitions too; otherwise clicking “下方” on
  // a previously added row silently appends the new field at the end.
  if(afterKey.isBlank()&&!afterType.isBlank()) for(var line:customDefinitions(target)) {
    var parts=line.split("\\|",-1);
    if(parts.length>=2&&(normalizedLabel(parts[1]).equals(normalizedLabel(afterType))||parts[0].equalsIgnoreCase(afterType))) {afterKey=parts[0];break;}
  }
  if("before".equalsIgnoreCase(java.util.Optional.ofNullable(request.position()).orElse("after"))&&!afterKey.isBlank()) {
   var ordered=orderedFields(target); var targetKey=afterKey; var targetIndex=java.util.stream.IntStream.range(0,ordered.size()).filter(i->ordered.get(i).key().equalsIgnoreCase(targetKey)).findFirst().orElse(-1);
   afterKey=targetIndex>0?ordered.get(targetIndex-1).key():"";
  }
  if(Boolean.TRUE.equals(request.inheritLabel()) && !afterKey.isBlank()) {
   for(var def:orderedFields(target)) if(def.key().equalsIgnoreCase(afterKey)){ label=def.label(); break; }
  }
  // Idempotency: a double click or a retried request for the same label,
  // type and anchor must return the existing row instead of creating another
  // blank field.
  for(var line:customDefinitions(target)) {
   var parts=line.split("\\|",-1);
   if(parts.length>=4 && normalizedLabel(parts[1]).equals(normalizedLabel(label))
      && parts[2].equalsIgnoreCase(afterKey) && parts[3].equalsIgnoreCase(type)) {
    var existing=new java.util.LinkedHashMap<String,Object>();
    existing.put("key",parts[0]); existing.put("label",parts[1]); existing.put("type",parts[3]);
    existing.put("tableId",target.getId()); existing.put("rowNumber",targetRow.getRowNumber());
    return existing;
   }
  }
  var defs=new java.util.ArrayList<String>(customDefinitions(target));
  defs.add(key+"|"+label.replace("|","/")+"|"+afterKey+"|"+type+"|组装");
  // Persist one definition per physical line. This fixes the historical
  // literal-\\n format and makes subsequent insert/delete operations stable.
  target.setCustomFieldDefs(String.join("\n",defs));
  for(var row:target.getRows()) if(row.getValues().stream().noneMatch(v->key.equals(v.getFieldKey()))){var value=new com.slss.domain.ScanTableValue();value.setRow(row);value.setFieldKey(key);value.setFieldValue("");row.getValues().add(value);}
  scanTables.save(target); audit.record(actor(),"FORCE_ADD_SCAN_COLUMN","SCAN_TABLE",String.valueOf(target.getId()),"强制增加完工扫码列: "+label,null,true);
  var response=new java.util.LinkedHashMap<String,Object>();response.put("key",key);response.put("label",label);response.put("type",type);response.put("tableId",target.getId());response.put("rowNumber",targetRow.getRowNumber());return response;
 }
 @DeleteMapping("/{machineSn}/force-column")
 @PreAuthorize("hasAnyAuthority('PERM_DELETE_PRODUCTION_COLUMN','PERM_FORCE_EDIT_COMPLETED_SCAN','PERM_MANAGE_PRODUCTION')")
 @org.springframework.transaction.annotation.Transactional
 public Object forceDeleteColumn(@PathVariable String machineSn,@RequestBody ForceColumnRequest request){
  var targetMachineSn=java.util.Optional.ofNullable(machineSn).orElse("").trim();
  var label=java.util.Optional.ofNullable(request==null?null:request.label()).orElse("").trim();
  if(label.isBlank()) throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST,"删除列名称不能为空");
  com.slss.domain.ScanTable target=null;
  outer: for(var table:scanTables.findAll()){ if(!canAccessTable(table)) continue; for(var row:table.getRows()) {
   var matchesTarget=targetMachineSn.equalsIgnoreCase(machineSnForRow(table,row))||row.getValues().stream().anyMatch(v->targetMachineSn.equalsIgnoreCase(java.util.Optional.ofNullable(v.getFieldValue()).orElse("").trim()));
   if(matchesTarget){target=table;break outer;}
  } }
  if(target==null) throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.NOT_FOUND,"未找到整机 SN 对应的扫码表");
  tenantScope.requireAccess(target.getTenant());
  var occurrence=java.util.Optional.ofNullable(request==null?null:request.occurrence()).orElse(0);
  var requestedKey=java.util.Optional.ofNullable(request==null?null:request.fieldKey()).orElse("").trim();
  if(!requestedKey.isBlank()) {
   var keyLine=customDefinitions(target).stream().filter(line->line.startsWith(requestedKey+"|")).findFirst().orElse(null);
   if(keyLine==null){
    target.getRows().forEach(row->row.getValues().removeIf(value->requestedKey.equals(value.getFieldKey())));
    scanTables.save(target);
    return java.util.Map.of("deleted",true,"key",requestedKey,"tableId",target.getId());
   }
   var keyParts=keyLine.split("\\|",-1); label=keyParts.length>=2?keyParts[1].trim():label;
   occurrence=0;
   var defsByKey=customDefinitions(target).stream().filter(line->!line.startsWith(requestedKey+"|")).toList();
   target.setCustomFieldDefs(String.join("\n",defsByKey));
   target.getRows().forEach(row->row.getValues().removeIf(value->requestedKey.equals(value.getFieldKey())));
   scanTables.save(target); audit.record(actor(),"FORCE_DELETE_SCAN_COLUMN","SCAN_TABLE",String.valueOf(target.getId()),"强制删除完工扫码列: "+label,null,true);
   return java.util.Map.of("deleted",true,"label",label,"key",requestedKey,"tableId",target.getId());
  }
  final var deleteLabel=label; final var deleteOccurrence=occurrence;
  var seen=new java.util.concurrent.atomic.AtomicInteger(0); var removed=new java.util.concurrent.atomic.AtomicBoolean(false);
  var defs=customDefinitions(target).stream().filter(line->{var parts=line.split("\\|",-1);if(parts.length>=2&&deleteLabel.equalsIgnoreCase(parts[1].trim())){var current=seen.getAndIncrement();if(current==deleteOccurrence){removed.set(true);return false;}}return true;}).toList();
  if(!removed.get()) throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.NOT_FOUND,"未找到可删除的自定义行");
  var removedKeys=customDefinitions(target).stream().filter(line->{var parts=line.split("\\|",-1);return parts.length>=2&&deleteLabel.equalsIgnoreCase(parts[1].trim());}).skip(deleteOccurrence).limit(1).map(line->line.split("\\|",-1)[0]).collect(java.util.stream.Collectors.toSet());
  target.setCustomFieldDefs(String.join("\n",defs));
  target.getRows().forEach(row->row.getValues().removeIf(value->removedKeys.contains(value.getFieldKey())));
  scanTables.save(target); audit.record(actor(),"FORCE_DELETE_SCAN_COLUMN","SCAN_TABLE",String.valueOf(target.getId()),"强制删除完工扫码列: "+label,null,true);
  return java.util.Map.of("deleted",true,"label",label,"tableId",target.getId());
 }
 private boolean hasAuthority(String code){var auth=SecurityContextHolder.getContext().getAuthentication();return auth!=null&&auth.getAuthorities().stream().anyMatch(a->code.equals(a.getAuthority()));}
 private String actor(){return java.util.Optional.ofNullable(SecurityContextHolder.getContext().getAuthentication()).map(x->x.getName()).orElse("system");}
}
