package com.slss.api;
import com.slss.domain.*;
import com.slss.service.ProductionBatchService;
import com.slss.service.TenantScopeService;
import com.slss.repository.*;
import jakarta.validation.constraints.NotBlank;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/api/v1/production/batches")
public class ProductionBatchController {
  final ProductionBatchService service;
  final AssetRepository assets; final AssetComponentRepository components; final LifecycleEventRepository lifecycle; final ScanTableRepository scanTables; final ProductionBatchRepository batches; final TenantScopeService tenantScope;
  public ProductionBatchController(ProductionBatchService s,AssetRepository a,AssetComponentRepository c,LifecycleEventRepository l,ScanTableRepository st,ProductionBatchRepository b,TenantScopeService ts){service=s;assets=a;components=c;lifecycle=l;scanTables=st;batches=b;tenantScope=ts;}
  public record CreateRequest(@NotBlank String batchName){}
  public record BatchResponse(Long id,String batchName,String status){}
  public record ComponentDraft(String type,String model,String serialNo){}
  private BatchResponse response(ProductionBatch b){return new BatchResponse(b.getId(),b.getBatchName(),b.getStatus());}
  @PostMapping
  @PreAuthorize("hasAnyAuthority('PERM_MANAGE_PRODUCTION','PERM_CREATE_SCAN_TABLE')")
  public BatchResponse create(@RequestBody CreateRequest r){return response(service.create(r.batchName()));}
  @PostMapping("/{id}/draft-rows")
  @PreAuthorize("hasAnyAuthority('PERM_MANAGE_PRODUCTION','PERM_CREATE_SCAN_TABLE')")
  public Map<String,String> saveDraft(@PathVariable Long id,@RequestBody Asset row){var batch=batches.findById(id).orElseThrow(()->new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.NOT_FOUND,"批次不存在"));tenantScope.requireAccess(batch.getTenant());var saved=service.saveDraftRow(id,row);return Map.of("machineSn",saved.getMachineSn(),"status","SAVED");}
  @PutMapping("/{id}/draft-rows/{machineSn}/components")
  @PreAuthorize("hasAnyAuthority('PERM_MANAGE_PRODUCTION','PERM_CREATE_SCAN_TABLE')")
  @org.springframework.transaction.annotation.Transactional
  public void saveComponents(@PathVariable Long id,@PathVariable String machineSn,@RequestBody List<ComponentDraft> rows){
    var batch=batches.findById(id).orElseThrow(()->new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.NOT_FOUND,"批次不存在"));
    tenantScope.requireAccess(batch.getTenant());
    var asset=assets.findByBatch_IdAndMachineSnIgnoreCase(id,machineSn).orElseThrow();
    var auth=org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
    for(var row:rows){if(row.serialNo()==null||row.serialNo().isBlank())continue;var serial=row.serialNo().trim();var duplicate=components.findBySerialNo(serial);if(duplicate.isPresent()&&!duplicate.get().getAsset().getId().equals(asset.getId())){var allowed=auth.getAuthorities().stream().anyMatch(a->a.getAuthority().equals("PERM_FORCE_DUPLICATE_SN"));if(!allowed)throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.CONFLICT,"配件 SN "+serial+" 已存在于设备 "+duplicate.get().getAsset().getMachineSn()+" 的 "+duplicate.get().getComponentType()+"，不能重复使用");components.delete(duplicate.get());}var c=components.findByAssetIdAndComponentType(asset.getId(),row.type()).orElseGet(AssetComponent::new);c.setAsset(asset);c.setComponentType(row.type());c.setModel(row.model());c.setSerialNo(serial);components.save(c);}
  }
  @PostMapping("/{id}/commit")
  @PreAuthorize("hasAnyAuthority('PERM_MANAGE_PRODUCTION','PERM_CREATE_SCAN_TABLE')")
  public BatchResponse commit(@PathVariable Long id,@RequestBody List<Asset> rows){var batch=batches.findById(id).orElseThrow(()->new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.NOT_FOUND,"批次不存在"));tenantScope.requireAccess(batch.getTenant());return response(service.commit(id,rows));}
  @GetMapping("/duplicate-sn")
  @PreAuthorize("hasAnyAuthority('PERM_MANAGE_PRODUCTION','PERM_CREATE_SCAN_TABLE','PERM_MANAGE_PRODUCTION_REPAIR')")
  @org.springframework.transaction.annotation.Transactional(readOnly = true)
  public Map<String,String> duplicate(@RequestParam String serialNo,@RequestParam(required=false) Long excludeScanTableId,@RequestParam(required=false) Integer excludeRowNumber){
    var value=serialNo.trim();
    // If the value is already present in the row currently being edited, it
    // is not a duplicate. Check this before assets/components because older
    // imported data may also contain the same SN in the legacy tables.
    if(excludeScanTableId!=null&&excludeRowNumber!=null){
      var currentTable=scanTables.findById(excludeScanTableId).orElse(null);
      if(currentTable!=null){
        var currentRow=currentTable.getRows().stream().filter(r->excludeRowNumber.equals(r.getRowNumber())).findFirst().orElse(null);
        if(currentRow!=null&&currentRow.getValues().stream().anyMatch(v->value.equalsIgnoreCase(Optional.ofNullable(v.getFieldValue()).orElse("")))) return Map.of();
      }
    }
    var asset=assets.findByMachineSnIgnoreCase(value);
    if(asset.isPresent() && tenantScope.canAccess(asset.get().getBatch()==null?null:asset.get().getBatch().getTenant())) return Map.of("serialNo",value,"machineSn",asset.get().getMachineSn(),"component","整机 SN");
    var component=components.findBySerialNoIgnoreCase(value);
    if(component.isPresent() && component.get().getAsset()!=null && tenantScope.canAccess(component.get().getAsset().getBatch()==null?null:component.get().getAsset().getBatch().getTenant())) return Map.of("serialNo",value,"machineSn",component.get().getAsset().getMachineSn(),"component",Optional.ofNullable(component.get().getComponentType()).orElse("配件 SN"));
    for(var table:scanTables.findAll().stream().filter(t->tenantScope.canAccess(t.getTenant())).toList()){
      if(excludeScanTableId!=null&&excludeScanTableId.equals(table.getId())) continue;
      for(var row:table.getRows()) {
      // Editing an already loaded row must not report its own unchanged value
      // as a duplicate. Other rows in the same table remain subject to the
      // global uniqueness check.
      if(excludeScanTableId!=null&&excludeScanTableId.equals(table.getId())&&excludeRowNumber!=null&&excludeRowNumber.equals(row.getRowNumber())) continue;
      var matched=row.getValues().stream().filter(v->value.equalsIgnoreCase(Optional.ofNullable(v.getFieldValue()).orElse(""))).findFirst();
      if(matched.isPresent()) {
        var machine=row.getValues().stream().filter(v->"machine_sn".equalsIgnoreCase(v.getFieldKey())).map(ScanTableValue::getFieldValue).findFirst().orElse("");
        if(!machine.isBlank()) return Map.of("serialNo",value,"machineSn",machine,"component",matched.get().getFieldKey());
      }
      }
    }
    return Map.of();
  }
  @GetMapping("/statistics")
  // Statistics are read-only. Employees who can view production, operate
  // production repair, or view the dashboard may query them; no mutation
  // permission is implied by this endpoint.
  @PreAuthorize("hasAnyAuthority('PERM_VIEW_PRODUCTION','PERM_MANAGE_PRODUCTION','PERM_CREATE_SCAN_TABLE','PERM_MANAGE_PRODUCTION_REPAIR','PERM_VIEW_DASHBOARD','PERM_VIEW_ORDERS')")
  @org.springframework.transaction.annotation.Transactional(readOnly = true)
  public Map<String,Object> statistics(@RequestParam java.time.LocalDate from,@RequestParam java.time.LocalDate to){
    if(to.isBefore(from))throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST,"结束日期不能早于开始日期");
    var zone=java.time.ZoneId.systemDefault();var start=from.atStartOfDay(zone).toInstant();var end=to.plusDays(1).atStartOfDay(zone).toInstant();
    var completed=new java.util.ArrayList<Map<String,Object>>();var unfinished=new java.util.ArrayList<Map<String,Object>>();
    // Production statistics are driven by the MES scan-table row state. A
    // production batch can remain open while individual machines are already
    // completed, so using batch.status here incorrectly marked every machine
    // as unfinished.
    for(var table:scanTables.findAll().stream().filter(t->tenantScope.canAccess(t.getTenant())).toList()){
      if(table.getCreatedAt()==null)continue;
      var tableInRange=!table.getCreatedAt().isBefore(start)&&table.getCreatedAt().isBefore(end);
      for(var scanRow:table.getRows()){
        // Older completed rows predate completed_at; use their last scanned
        // value as a reliable completion-time fallback for date searches.
        var lastScannedAt=scanRow.getValues().stream().map(ScanTableValue::getScannedAt).filter(java.util.Objects::nonNull).max(java.util.Comparator.naturalOrder()).orElse(null);
        var completedAt=scanRow.getCompletedAt()!=null?scanRow.getCompletedAt():lastScannedAt;
        var completionInRange=completedAt!=null&&!completedAt.isBefore(start)&&completedAt.isBefore(end);
        // A device may be created in one period and completed in another.
        // Include it for either period so completed Tianxing/other batches do
        // not disappear when statistics are searched by completion date.
        if(!tableInRange&&!completionInRange)continue;
        var machineSn=scanRow.getValues().stream().filter(v->"machine_sn".equalsIgnoreCase(v.getFieldKey())||"整机sn".equalsIgnoreCase(v.getFieldKey())).map(ScanTableValue::getFieldValue).filter(java.util.Objects::nonNull).filter(v->!v.isBlank()).findFirst().orElse(scanRow.getMachineSn());
        if(machineSn==null||machineSn.isBlank())continue;
        var detail=new java.util.LinkedHashMap<String,Object>();detail.put("scanTableId",table.getId());detail.put("customerName",table.getCustomerName());detail.put("machineSn",machineSn);detail.put("model",table.getModel());detail.put("batchName",table.getCustomerName()+" / "+table.getModel());detail.put("createdAt",table.getCreatedAt());
        if("COMPLETED".equalsIgnoreCase(scanRow.getStatus()))completed.add(detail);else unfinished.add(detail);
      }
    }
    // Keep legacy production-batch assets visible when they were imported
    // before MES scan tables existed.
    if(completed.isEmpty()&&unfinished.isEmpty()) for(var asset:assets.findAll()){var batch=asset.getBatch();if(batch==null||batch.getCreatedAt()==null||batch.getCreatedAt().isBefore(start)||!batch.getCreatedAt().isBefore(end))continue;var row=new java.util.LinkedHashMap<String,Object>();row.put("machineSn",asset.getMachineSn());row.put("model",asset.getModel()==null?"":asset.getModel());row.put("batchName",batch.getBatchName());row.put("createdAt",batch.getCreatedAt());if("COMMITTED".equalsIgnoreCase(batch.getStatus()))completed.add(row);else unfinished.add(row);}
    var repairEvents=lifecycle.findByEventTypeAndOccurredAtBetween("REPAIR_SWAP",start,end);
    var repairMap=new java.util.LinkedHashMap<Long,Map<String,Object>>();
    for(var event:repairEvents){var item=repairMap.computeIfAbsent(event.getAssetId(),id->{var value=new java.util.LinkedHashMap<String,Object>();value.put("machineSn",event.getMachineSn());value.put("model",event.getAssetModel());value.put("events",new java.util.ArrayList<Map<String,Object>>());return value;});var eventRow=new java.util.LinkedHashMap<String,Object>();eventRow.put("partName",java.util.Optional.ofNullable(event.getPartName()).orElse("配件"));eventRow.put("oldSn",java.util.Optional.ofNullable(event.getOldSn()).orElse(""));eventRow.put("newSn",java.util.Optional.ofNullable(event.getNewSn()).orElse(""));eventRow.put("occurredAt",event.getOccurredAt());eventRow.put("details",java.util.Optional.ofNullable(event.getDetails()).orElse(""));((java.util.List<Map<String,Object>>)item.get("events")).add(eventRow);}
    // Repairs made on scan-table-only devices predate lifecycle records. A
    // value scanned after the row was completed is an authoritative repair
    // signal; include it in statistics even when no legacy Asset existed.
    for(var table:scanTables.findAll()) for(var row:table.getRows()){
      var completedAt=row.getCompletedAt(); if(completedAt==null) continue;
      var changed=row.getValues().stream().filter(v->v.getScannedAt()!=null&&v.getScannedAt().isAfter(completedAt)&&v.getFieldValue()!=null&&!v.getFieldValue().isBlank()).toList();
      if(changed.isEmpty()) continue;
      var machine=java.util.Optional.ofNullable(row.getMachineSn()).filter(x->!x.isBlank()).orElseGet(()->row.getValues().stream().filter(v->"machine_sn".equalsIgnoreCase(v.getFieldKey())).map(ScanTableValue::getFieldValue).filter(x->x!=null&&!x.isBlank()).findFirst().orElse(""));
      if(machine.isBlank()) continue;
      var known=repairMap.values().stream().anyMatch(x->machine.equalsIgnoreCase(String.valueOf(x.get("machineSn"))));
      if(known) continue;
      var item=new java.util.LinkedHashMap<String,Object>();item.put("machineSn",machine);item.put("model",table.getModel());var events=new java.util.ArrayList<Map<String,Object>>();
      for(var value:changed){var e=new java.util.LinkedHashMap<String,Object>();e.put("partName",value.getFieldKey());e.put("oldSn","");e.put("newSn",value.getFieldValue());e.put("occurredAt",value.getScannedAt());e.put("details","扫码表完工后维修更新，操作员："+java.util.Optional.ofNullable(value.getOperatorNo()).orElse("未知"));events.add(e);}item.put("events",events);repairMap.put(-((long)table.getId()*100000L+row.getRowNumber()),item);
    }
    var result=new java.util.LinkedHashMap<String,Object>();result.put("from",from);result.put("to",to);result.put("completedCount",completed.size());result.put("unfinishedCount",unfinished.size());result.put("repairCount",repairMap.size());result.put("completedDevices",completed);result.put("unfinishedDevices",unfinished);result.put("repairDevices",repairMap.values());return result;
  }
}
