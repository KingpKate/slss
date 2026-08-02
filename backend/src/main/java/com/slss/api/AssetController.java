package com.slss.api;
import com.slss.domain.LifecycleEvent;
import com.slss.domain.ScanTemplateField;
import com.slss.repository.*; import com.slss.service.AuditService; import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize; import org.springframework.security.core.context.SecurityContextHolder;
@RestController @RequestMapping("/api/v1/assets") public class AssetController {
 private final AssetRepository repo; private final AssetComponentRepository components; private final LifecycleEventRepository lifecycle; private final ScanTableRepository scanTables; private final AuditService audit;
 public AssetController(AssetRepository repo,AssetComponentRepository components,LifecycleEventRepository lifecycle,ScanTableRepository scanTables,AuditService audit){this.repo=repo;this.components=components;this.lifecycle=lifecycle;this.scanTables=scanTables;this.audit=audit;}
 public record ComponentResponse(String type,String model,String serialNo,String operatorNo,String faultDescription){}
 public record ForceComponentRequest(String type,String model,String serialNo,String faultDescription){}
 public record ForceScanRequest(java.util.List<ForceComponentRequest> components){}
 public record AssetResponse(Long id,String machineSn,String contractNo,java.time.LocalDate invoiceDate,String model,String batchName,java.time.Instant batchCreatedAt,java.util.List<ComponentResponse> components){}
 private record FieldDef(String key,String label){}
 private java.util.List<FieldDef> orderedFields(com.slss.domain.ScanTable table){
  var hidden=table.getHiddenFieldKeys()==null?java.util.Set.<String>of():new java.util.HashSet<>(java.util.Arrays.asList(table.getHiddenFieldKeys().split(",")));
  var fields=new java.util.ArrayList<FieldDef>();
  table.getTemplate().getFields().stream().filter(f->!hidden.contains(f.getFieldKey())).sorted(java.util.Comparator.comparingInt(ScanTemplateField::getSortOrder)).forEach(f->fields.add(new FieldDef(f.getFieldKey(),f.getFieldLabel())));
  if(table.getCustomFieldDefs()!=null)for(var definition:table.getCustomFieldDefs().split("\\n")){
   var parts=definition.split("\\|",-1);if(parts.length<2||hidden.contains(parts[0]))continue;
   var after=parts.length>=3?parts[2]:"";var position=-1;for(var i=0;i<fields.size();i++)if(after.equals(fields.get(i).key()))position=i;
   fields.add(position>=0?position+1:fields.size(),new FieldDef(parts[0],parts[1]));
  }
  return fields;
 }
 private java.util.Optional<com.slss.domain.ScanTableValue> scanValueFor(String machineSn,String partType){
  if(partType==null||partType.isBlank()) return java.util.Optional.empty();
  for(var table:scanTables.findAll()) for(var row:table.getRows()){
   var machine=row.getValues().stream().filter(v->"machine_sn".equalsIgnoreCase(v.getFieldKey())).map(com.slss.domain.ScanTableValue::getFieldValue).findFirst().orElse(row.getMachineSn());
   if(machine==null||!machineSn.equalsIgnoreCase(machine)) continue;
   var defs=orderedFields(table);
   for(var def:defs) if(partType.equalsIgnoreCase(def.label())) return row.getValues().stream().filter(v->def.key().equals(v.getFieldKey())).findFirst();
  }
  return java.util.Optional.empty();
 }
 private String componentKey(String value){
  if(value==null)return "";
  return value.toLowerCase(java.util.Locale.ROOT).replaceAll("sn|序列号|型号|[^a-z0-9\\u4e00-\\u9fff]","");
 }
 private AssetResponse dto(com.slss.domain.Asset a){
  var result=new java.util.ArrayList<ComponentResponse>();
  var existing=new java.util.HashSet<String>();
  scanTables.findAll().stream().filter(t->t.getRows().stream().anyMatch(r->r.getValues().stream().anyMatch(v->"machine_sn".equalsIgnoreCase(v.getFieldKey())&&a.getMachineSn().equalsIgnoreCase(v.getFieldValue())))).findFirst().ifPresent(t->{
   var row=t.getRows().stream().filter(r->r.getValues().stream().anyMatch(v->"machine_sn".equalsIgnoreCase(v.getFieldKey())&&a.getMachineSn().equalsIgnoreCase(v.getFieldValue()))).findFirst().orElse(null);
   if(row!=null) {
    var values=new java.util.HashMap<String,String>();var operators=new java.util.HashMap<String,String>();row.getValues().forEach(v->{values.put(v.getFieldKey(),v.getFieldValue());operators.put(v.getFieldKey(),v.getOperatorNo());});
    var fields=orderedFields(t);
    for(var index=0;index<fields.size();index++){
     var field=fields.get(index);var serial=values.get(field.key());
     var isSn=!"machine_sn".equalsIgnoreCase(field.key())&&(field.key().toLowerCase(java.util.Locale.ROOT).contains("sn")||field.label().toLowerCase(java.util.Locale.ROOT).matches(".*(sn|序列号).*"));
     if(!isSn||serial==null||serial.isBlank()||existing.contains(serial.toLowerCase(java.util.Locale.ROOT)))continue;
     var model="";for(var cursor=index-1;cursor>=0;cursor--){var candidate=fields.get(cursor);if(candidate.label().contains("型号")||candidate.key().toLowerCase(java.util.Locale.ROOT).contains("model")||candidate.key().endsWith("_info")){model=java.util.Optional.ofNullable(values.get(candidate.key())).orElse("");break;}}
     result.add(new ComponentResponse(field.label(),model,serial,operators.get(field.key()),null));existing.add(serial.toLowerCase(java.util.Locale.ROOT));
    }
   }
  });
  components.findByAssetIdOrderById(a.getId()).forEach(c->{
   var key=componentKey(c.getComponentType());
   for(var i=0;i<result.size();i++) if(componentKey(result.get(i).type()).equals(key)&&!key.isBlank()){
    var previous=result.get(i); result.set(i,new ComponentResponse(c.getComponentType(),c.getModel(),c.getSerialNo(),previous.operatorNo(),c.getFaultDescription()));
    existing.add(c.getSerialNo().toLowerCase(java.util.Locale.ROOT)); return;
   }
   if(existing.add(c.getSerialNo().toLowerCase(java.util.Locale.ROOT)))result.add(new ComponentResponse(c.getComponentType(),c.getModel(),c.getSerialNo(),null,c.getFaultDescription()));
  });
  return new AssetResponse(a.getId(),a.getMachineSn(),a.getContractNo(),a.getInvoiceDate(),a.getModel(),a.getBatch()==null?null:a.getBatch().getBatchName(),a.getBatch()==null?null:a.getBatch().getCreatedAt(),result);
 }
 @GetMapping @PreAuthorize("hasAnyAuthority('PERM_VIEW_PRODUCTION','PERM_MANAGE_PRODUCTION')") @org.springframework.transaction.annotation.Transactional(readOnly=true) public Object list(){return repo.findAll().stream().map(this::dto).toList();}
 @GetMapping("/{machineSn}") @PreAuthorize("hasAnyAuthority('PERM_VIEW_PRODUCTION','PERM_MANAGE_PRODUCTION','PERM_MANAGE_PRODUCTION_REPAIR','PERM_FORCE_EDIT_COMPLETED_SCAN')") @org.springframework.transaction.annotation.Transactional(readOnly=true) public Object get(@PathVariable String machineSn){
  var existing=repo.findByMachineSnIgnoreCase(machineSn);
  return existing.<Object>map(this::dto).orElseGet(() -> repairLookup(machineSn));
 }
 @GetMapping("/repair-lookup/{serialNo}")
 @PreAuthorize("hasAnyAuthority('PERM_VIEW_PRODUCTION','PERM_MANAGE_PRODUCTION','PERM_MANAGE_PRODUCTION_REPAIR','PERM_FORCE_EDIT_COMPLETED_SCAN')")
 @org.springframework.transaction.annotation.Transactional(readOnly=true)
 public Object repairLookup(@PathVariable String serialNo){
  var value=java.util.Optional.ofNullable(serialNo).orElse("").trim();
  if(value.isBlank()) throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST,"SN 不能为空");
  var existing=repo.findByMachineSnIgnoreCase(value);
  if(existing.isPresent()) return dto(existing.get());
  for(var table:scanTables.findAll()){
   for(var row:table.getRows()){
    var defs=orderedFields(table);
    var values=new java.util.HashMap<String,String>();var operators=new java.util.HashMap<String,String>();
    row.getValues().forEach(v->{values.put(v.getFieldKey(),v.getFieldValue());operators.put(v.getFieldKey(),v.getOperatorNo());});
    var machine=java.util.Optional.ofNullable(row.getMachineSn()).filter(x->!x.isBlank()).orElseGet(()->defs.stream().filter(d->"machine_sn".equalsIgnoreCase(d.key())||d.label().matches(".*整机.*SN.*")).map(d->values.get(d.key())).filter(x->x!=null&&!x.isBlank()).findFirst().orElse(""));
    var matched=values.entrySet().stream().anyMatch(e->value.equalsIgnoreCase(java.util.Optional.ofNullable(e.getValue()).orElse("")));
    if(!matched||machine.isBlank()) continue;
    var result=new java.util.ArrayList<ComponentResponse>();var seen=new java.util.HashSet<String>();
    for(var index=0;index<defs.size();index++){
     var field=defs.get(index);var serial=values.get(field.key());
     var isMachine="machine_sn".equalsIgnoreCase(field.key())||field.label().matches(".*整机.*SN.*");
     var isSn=!isMachine&&(field.key().toLowerCase(java.util.Locale.ROOT).contains("sn")||field.label().toLowerCase(java.util.Locale.ROOT).matches(".*(sn|序列号).*"));
     if(!isSn||serial==null||serial.isBlank()||!seen.add(serial.toLowerCase(java.util.Locale.ROOT))) continue;
     var model="";for(var cursor=index-1;cursor>=0;cursor--){var candidate=defs.get(cursor);if(candidate.label().contains("型号")||candidate.key().toLowerCase(java.util.Locale.ROOT).contains("model")||candidate.key().endsWith("_info")){model=java.util.Optional.ofNullable(values.get(candidate.key())).orElse("");break;}}
     result.add(new ComponentResponse(field.label(),model,serial,operators.get(field.key()),null));
    }
    var response=new java.util.LinkedHashMap<String,Object>();response.put("id",null);response.put("machineSn",machine);response.put("contractNo","");response.put("invoiceDate",null);response.put("model",table.getModel());response.put("batchName",table.getCustomerName()+" / "+table.getModel());response.put("batchCreatedAt",table.getCreatedAt());response.put("components",result);response.put("scanOnly",true);response.put("scanTableId",table.getId());response.put("rowNumber",row.getRowNumber());return response;
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
   var target=java.util.Optional.<com.slss.domain.ScanTable>empty(); com.slss.domain.ScanTableRow targetRow=null;
   outer: for(var table:scanTables.findAll()) for(var row:table.getRows()){
    var machine=java.util.Optional.ofNullable(row.getMachineSn()).filter(x->!x.isBlank()).orElseGet(()->row.getValues().stream().filter(v->"machine_sn".equalsIgnoreCase(v.getFieldKey())).map(com.slss.domain.ScanTableValue::getFieldValue).filter(x->x!=null&&!x.isBlank()).findFirst().orElse(""));
    if(machineSn.equalsIgnoreCase(machine)){target=java.util.Optional.of(table);targetRow=row;break outer;}
   }
   if(target.isEmpty()||targetRow==null) throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.NOT_FOUND,"未找到整机 SN");
   var table=target.get();var defs=orderedFields(table);
   var asset=new com.slss.domain.Asset();asset.setMachineSn(machineSn.trim());asset.setModel(table.getModel());asset=repo.save(asset);
   for(var change:request.components()==null?java.util.List.<ForceComponentRequest>of():request.components()){
    if(change==null||change.serialNo()==null||change.serialNo().isBlank())continue;
    var def=defs.stream().filter(d->d.label().equalsIgnoreCase(java.util.Optional.ofNullable(change.type()).orElse(""))||d.key().equalsIgnoreCase(java.util.Optional.ofNullable(change.type()).orElse(""))).findFirst().orElse(null);
    if(def==null)continue;
    var value=targetRow.getValues().stream().filter(v->def.key().equals(v.getFieldKey())).findFirst().orElse(null);
    if(value==null){value=new com.slss.domain.ScanTableValue();value.setRow(targetRow);value.setFieldKey(def.key());targetRow.getValues().add(value);}
    var oldSn=java.util.Optional.ofNullable(value.getFieldValue()).orElse("").trim();var newSn=change.serialNo().trim();
    if(!oldSn.equalsIgnoreCase(newSn)){
     if(change.faultDescription()==null||change.faultDescription().isBlank()) throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST,"配件 "+change.type()+" 更换时必须填写故障描述");
     var duplicate=components.findBySerialNoIgnoreCase(newSn);if(duplicate.isPresent()&&!duplicate.get().getAsset().getId().equals(asset.getId()))throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.CONFLICT,"配件 SN "+newSn+" 已存在于其他设备");
     var component=new com.slss.domain.AssetComponent();component.setAsset(asset);component.setComponentType(change.type()==null?def.label():change.type().trim());component.setModel(change.model());component.setSerialNo(newSn);component.setFaultDescription(change.faultDescription().trim());components.save(component);
     var event=new LifecycleEvent();event.setAsset(asset);event.setEventType("REPAIR_SWAP");event.setPartName(change.type()==null?def.label():change.type().trim());event.setOldSn(oldSn);event.setNewSn(newSn);event.setFaultDescription(change.faultDescription().trim());event.setDetails("生产维修更换配件，维修员："+(principal==null?actor():principal.getName()));lifecycle.save(event);
    }
    value.setFieldValue(newSn);value.setOperatorNo(principal==null?actor():principal.getName());value.setScannedAt(java.time.Instant.now());
   }
   scanTables.save(table);audit.record(actor(),"ASSET_FORCE_SCAN","SCAN_TABLE",String.valueOf(table.getId()),"生产维修更新扫码表配件",null,true);return repairLookup(machineSn);
  }
  var asset=assetOpt.get();
  for(var row:request.components()==null?java.util.List.<ForceComponentRequest>of():request.components()){
   if(row.type()==null||row.type().isBlank()||row.serialNo()==null||row.serialNo().isBlank())continue;
   var duplicate=components.findBySerialNoIgnoreCase(row.serialNo().trim());
   if(duplicate.isPresent()&&!duplicate.get().getAsset().getId().equals(asset.getId()))throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.CONFLICT,"配件 SN "+row.serialNo()+" 已存在于设备 "+duplicate.get().getAsset().getMachineSn()+" 的 "+duplicate.get().getComponentType());
   // 同一整机的已有 SN 直接复用原记录，避免因扫码表字段标签与资产组件类型不同而重复插入。
   var component=duplicate.filter(c->c.getAsset().getId().equals(asset.getId())).orElseGet(()->components.findByAssetIdAndComponentType(asset.getId(),row.type()).orElseGet(com.slss.domain.AssetComponent::new));
   var originalScanValue=scanValueFor(asset.getMachineSn(),row.type());
   var newSn=row.serialNo().trim();
   var scanOld=originalScanValue.map(com.slss.domain.ScanTableValue::getFieldValue).filter(v->v!=null&&!v.isBlank()&&!v.equalsIgnoreCase(newSn)).orElse(null);
   var oldSn=scanOld!=null?scanOld:(component.getId()==null?null:component.getSerialNo());
   var changed=oldSn==null||!oldSn.equalsIgnoreCase(newSn);
   if(changed&&(row.faultDescription()==null||row.faultDescription().isBlank())) throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST,"配件 "+row.type()+" 更换时必须填写故障描述");
   component.setAsset(asset);component.setComponentType(row.type().trim());component.setModel(row.model());component.setSerialNo(row.serialNo().trim());components.save(component);
   component.setFaultDescription(row.faultDescription()==null?component.getFaultDescription():row.faultDescription().trim());
   originalScanValue.ifPresent(v->{v.setFieldValue(newSn);v.setOperatorNo(principal==null?null:principal.getName());v.setScannedAt(java.time.Instant.now());});
   if(oldSn!=null&&!oldSn.isBlank()&&!oldSn.equalsIgnoreCase(newSn)){
    var event=new LifecycleEvent();event.setAsset(asset);event.setEventType("REPAIR_SWAP");event.setPartName(row.type().trim());event.setOldSn(oldSn);event.setNewSn(newSn);event.setFaultDescription(row.faultDescription().trim());event.setDetails("生产维修更换配件，维修员："+(principal==null?"未知":principal.getName()));lifecycle.save(event);
   }
  }
  audit.record(actor(),"ASSET_FORCE_SCAN","ASSET",machineSn,"强制更换配件",null,true);
  return dto(asset);
 }
 private String actor(){return java.util.Optional.ofNullable(SecurityContextHolder.getContext().getAuthentication()).map(x->x.getName()).orElse("system");}
}
