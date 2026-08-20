package com.slss.api;
import com.slss.domain.*; import com.slss.repository.*; import com.slss.service.TenantScopeService; import org.springframework.security.access.prepost.PreAuthorize; import org.springframework.web.bind.annotation.*; import java.util.*; import java.time.*;
@RestController @RequestMapping("/api/v1/dashboard") @PreAuthorize("hasAuthority('PERM_VIEW_DASHBOARD')") @org.springframework.transaction.annotation.Transactional(readOnly=true)
public class DashboardController {
 private final RepairOrderRepository orders; private final AssetRepository assets; private final LifecycleEventRepository lifecycle; private final ScanTableRepository scanTables; private final TenantScopeService tenantScope; public DashboardController(RepairOrderRepository o,AssetRepository a,LifecycleEventRepository l,ScanTableRepository s,TenantScopeService ts){orders=o;assets=a;lifecycle=l;scanTables=s;tenantScope=ts;}
 private boolean access(CustomerTenant tenant){return tenantScope.canAccess(tenant);}
 private List<RepairOrder> visibleOrders(){return orders.findAll().stream().filter(o->access(o.getTenant())).toList();}
 private List<LifecycleEvent> visibleEvents(){return lifecycle.findAll().stream().filter(e->access(e.getTenant())).toList();}
 private List<Asset> visibleAssets(){return assets.findAll().stream().filter(a->access(a.getTenant()!=null?a.getTenant():a.getBatch()==null?null:a.getBatch().getTenant())).toList();}
 private List<ScanProductionAggregate> scanAggregates(Instant from,Instant to){if(tenantScope.isSystemAdmin())return scanTables.productionAggregateAll(from,to);var ids=tenantScope.currentTenantIds();return ids.isEmpty()?List.of():scanTables.productionAggregate(ids,from,to);}
 private List<ScanProductionAggregate> currentScanAggregates(){if(tenantScope.isSystemAdmin())return scanTables.productionAggregateCurrentAll();var ids=tenantScope.currentTenantIds();return ids.isEmpty()?scanTables.productionAggregateCurrentAll():scanTables.productionAggregateCurrent(ids);}
 private List<ScanProductionDetailAggregate> scanDetailAggregates(Instant from,Instant to,boolean completed){if(tenantScope.isSystemAdmin())return completed?scanTables.completedDetailAggregateAll(from,to):scanTables.unfinishedDetailAggregateAll(from,to);var ids=tenantScope.currentTenantIds();if(ids.isEmpty())return List.of();return completed?scanTables.completedDetailAggregate(ids,from,to):scanTables.unfinishedDetailAggregate(ids,from,to);}
 private List<ScanProductionDetailAggregate> currentScanDetailAggregates(boolean completed){if(tenantScope.isSystemAdmin())return completed?scanTables.completedDetailAggregateCurrentAll():scanTables.unfinishedDetailAggregateCurrentAll();var ids=tenantScope.currentTenantIds();return ids.isEmpty()?(completed?scanTables.completedDetailAggregateCurrentAll():scanTables.unfinishedDetailAggregateCurrentAll()):(completed?scanTables.completedDetailAggregateCurrent(ids):scanTables.unfinishedDetailAggregateCurrent(ids));}
 private List<Map<String,Object>> detailRows(Instant from,Instant to,boolean completed){return scanDetailAggregates(from,to,completed).stream().<Map<String,Object>>map(item->{var row=new LinkedHashMap<String,Object>();row.put("customerName",Optional.ofNullable(item.getCustomerName()).orElse("未知客户"));row.put("model",Optional.ofNullable(item.getModel()).orElse("未设置型号"));row.put("quantity",item.getQuantity()==null?0L:item.getQuantity());return row;}).toList();}
 @GetMapping("/summary") public Map<String,Object> summary(){var visible=visibleOrders();var va=visibleAssets();var result=new LinkedHashMap<String,Object>();result.put("totalOrders",visible.size());for(var s:List.of(OrderStatus.PENDING,OrderStatus.ASSIGNED,OrderStatus.CHECKING,OrderStatus.CLOSED))result.put(s.name().toLowerCase(Locale.ROOT),visible.stream().filter(o->o.getStatus()==s).count());result.put("assets",va.size());return result;}
 @GetMapping("/statistics") public Map<String,Object> statistics(){var customer=new LinkedHashMap<String,Long>();visibleOrders().forEach(o->customer.merge(o.getCustomerName(),1L,Long::sum));var parts=new LinkedHashMap<String,Long>();visibleEvents().stream().filter(e->"REPAIR_SWAP".equals(e.getEventType())).forEach(e->parts.merge(Optional.ofNullable(e.getPartName()).orElse("其他"),1L,Long::sum));return Map.of("customers",customer.entrySet().stream().map(x->Map.of("name",x.getKey(),"value",x.getValue())).toList(),"components",parts.entrySet().stream().map(x->Map.of("name",x.getKey(),"value",x.getValue())).toList());}
 @GetMapping("/production") @org.springframework.transaction.annotation.Transactional(readOnly=true) public Map<String,Object> production(){
  var today=LocalDate.now();
  var weekStart=today.with(java.time.temporal.TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
  var completed=new LinkedHashMap<String,Long>(); var unfinished=new LinkedHashMap<String,Long>();
  var repairByCustomer=new LinkedHashMap<String,Long>();
  var completedDevices=new ArrayList<Map<String,Object>>();
  var unfinishedDevices=new ArrayList<Map<String,Object>>();
  var weekCompletedDevices=new ArrayList<Map<String,Object>>();
  var weekUnfinishedDevices=new ArrayList<Map<String,Object>>();
  long weekCompleted=0L,weekUnfinished=0L;
  var zone=ZoneId.systemDefault(); var todayStart=today.atStartOfDay(zone).toInstant(); var tomorrowStart=today.plusDays(1).atStartOfDay(zone).toInstant(); var weekStartInstant=weekStart.atStartOfDay(zone).toInstant();
  // The headline cards represent all currently visible production rows. A
  // batch can remain active across days, so filtering by scan-table creation
  // date incorrectly reported zero after midnight or after a restart.
  for(var aggregate:currentScanAggregates()){var name=Optional.ofNullable(aggregate.getCustomerName()).orElse("未知客户");completed.merge(name,aggregate.getCompletedCount(),Long::sum);unfinished.merge(name,aggregate.getUnfinishedCount(),Long::sum);}
  for(var aggregate:scanAggregates(weekStartInstant,tomorrowStart)){weekCompleted+=aggregate.getCompletedCount();weekUnfinished+=aggregate.getUnfinishedCount();}
  completedDevices.addAll(currentScanDetailAggregates(true).stream().<Map<String,Object>>map(item->{var row=new LinkedHashMap<String,Object>();row.put("customerName",Optional.ofNullable(item.getCustomerName()).orElse("未知客户"));row.put("model",Optional.ofNullable(item.getModel()).orElse("未设置型号"));row.put("quantity",item.getQuantity()==null?0L:item.getQuantity());return row;}).toList());
  unfinishedDevices.addAll(currentScanDetailAggregates(false).stream().<Map<String,Object>>map(item->{var row=new LinkedHashMap<String,Object>();row.put("customerName",Optional.ofNullable(item.getCustomerName()).orElse("未知客户"));row.put("model",Optional.ofNullable(item.getModel()).orElse("未设置型号"));row.put("quantity",item.getQuantity()==null?0L:item.getQuantity());return row;}).toList());
  weekCompletedDevices.addAll(detailRows(weekStartInstant,tomorrowStart,true));
  weekUnfinishedDevices.addAll(detailRows(weekStartInstant,tomorrowStart,false));
  var todayRepairs=lifecycle.findByEventTypeAndOccurredAtBetween("REPAIR_SWAP",todayStart,tomorrowStart).stream().filter(e->access(e.getTenant())).toList();
  var weekRepairEvents=lifecycle.findByEventTypeAndOccurredAtBetween("REPAIR_SWAP",weekStartInstant,tomorrowStart).stream().filter(e->access(e.getTenant())).toList();
  var weekRepair=weekRepairEvents.stream().map(event->event.getAssetId()).distinct().count();
  for(var event:todayRepairs){var name=Optional.ofNullable(event.getBatchName()).orElse("未知客户").split("_PROD_",2)[0];repairByCustomer.put(name,1L);}
  var customers=new LinkedHashSet<String>(); customers.addAll(completed.keySet()); customers.addAll(unfinished.keySet());
  customers.addAll(repairByCustomer.keySet());
  var rows=customers.stream().map(customer->Map.of("customer",customer,"completed",completed.getOrDefault(customer,0L),"unfinished",unfinished.getOrDefault(customer,0L),"repair",repairByCustomer.getOrDefault(customer,0L))).toList();
  var todayRepair=todayRepairs.stream().map(event->event.getAssetId()).distinct().count();
  java.util.function.Function<LifecycleEvent,Map<String,Object>> repairDetail=event->{var item=new LinkedHashMap<String,Object>();var batchName=Optional.ofNullable(event.getBatchName()).orElse("");var customer=batchName.contains("_PROD_")?batchName.split("_PROD_",2)[0]:batchName;item.put("customerName",customer.isBlank()?"未知客户":customer);item.put("machineSn",event.getMachineSn());item.put("model",event.getAssetModel());item.put("partName",Optional.ofNullable(event.getPartName()).orElse("配件"));item.put("oldSn",Optional.ofNullable(event.getOldSn()).orElse(""));item.put("newSn",Optional.ofNullable(event.getNewSn()).orElse(""));item.put("occurredAt",event.getOccurredAt());return item;};
  var repairDevices=todayRepairs.stream().collect(java.util.stream.Collectors.toMap(LifecycleEvent::getAssetId,repairDetail,(a,b)->a,java.util.LinkedHashMap::new)).values().stream().toList();
  var weekRepairDevices=weekRepairEvents.stream().collect(java.util.stream.Collectors.toMap(LifecycleEvent::getAssetId,repairDetail,(a,b)->a,java.util.LinkedHashMap::new)).values().stream().toList();
  var result=new LinkedHashMap<String,Object>(); result.put("date",today.toString()); result.put("weekStart",weekStart.toString()); result.put("customers",rows); result.put("completed",completed.values().stream().mapToLong(Long::longValue).sum()); result.put("unfinished",unfinished.values().stream().mapToLong(Long::longValue).sum()); result.put("repair",todayRepair); result.put("weekCompleted",weekCompleted); result.put("weekUnfinished",weekUnfinished); result.put("weekRepair",weekRepair); result.put("completedDevices",completedDevices); result.put("unfinishedDevices",unfinishedDevices); result.put("repairDevices",repairDevices); result.put("weekCompletedDevices",weekCompletedDevices); result.put("weekUnfinishedDevices",weekUnfinishedDevices); result.put("weekRepairDevices",weekRepairDevices); return result;
 }
 @GetMapping("/alerts") public Map<String,Object> alerts(){
  var overdue=orders.findBySlaDueAtBeforeAndStatusNotIn(Instant.now(),List.of(OrderStatus.CLOSED,OrderStatus.CANCELLED,OrderStatus.SUSPENDED,OrderStatus.SHIPPED)).stream().filter(o->access(o.getTenant())).map(o->Map.of(
   "id",o.getId(),"order_number",o.getOrderNumber(),"machine_sn",o.getMachineSn()==null?"":o.getMachineSn(),
   "created_at",o.getCreatedAt(),"sla_due_at",o.getSlaDueAt())).toList();
  var recurring=new ArrayList<Map<String,Object>>();var counts=new LinkedHashMap<String,Long>();visibleEvents().stream().filter(e->"REPAIR_SWAP".equals(e.getEventType())).forEach(e->counts.merge(e.getMachineSn()+"\u0000"+e.getPartName(),1L,Long::sum));counts.forEach((k,v)->{if(v>=2){var p=k.split("\u0000",2);recurring.add(Map.of("machine_sn",p[0],"part",p.length>1&&p[1]!=null?p[1]:"其他","count",v));}});
  return Map.of("overdue",overdue,"recurring",recurring);
 }
}
