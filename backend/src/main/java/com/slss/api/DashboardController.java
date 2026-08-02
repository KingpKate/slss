package com.slss.api;
import com.slss.domain.*; import com.slss.repository.*; import org.springframework.security.access.prepost.PreAuthorize; import org.springframework.web.bind.annotation.*; import java.util.*; import java.time.*;
@RestController @RequestMapping("/api/v1/dashboard") @PreAuthorize("hasAuthority('PERM_VIEW_DASHBOARD')")
public class DashboardController {
 private final RepairOrderRepository orders; private final AssetRepository assets; private final LifecycleEventRepository lifecycle; private final ScanTableRepository scanTables; public DashboardController(RepairOrderRepository o,AssetRepository a,LifecycleEventRepository l,ScanTableRepository s){orders=o;assets=a;lifecycle=l;scanTables=s;}
 @GetMapping("/summary") public Map<String,Object> summary(){var result=new LinkedHashMap<String,Object>();result.put("totalOrders",orders.count());result.put("pending",orders.countByStatus(OrderStatus.PENDING));result.put("assigned",orders.countByStatus(OrderStatus.ASSIGNED));result.put("checking",orders.countByStatus(OrderStatus.CHECKING));result.put("closed",orders.countByStatus(OrderStatus.CLOSED));result.put("assets",assets.count());return result;}
 @GetMapping("/statistics") public Map<String,Object> statistics(){return Map.of("customers",orders.customerStatistics().stream().map(x->Map.of("name",x[0],"value",x[1])).toList(),"components",lifecycle.replacementStatistics().stream().map(x->Map.of("name",x[0]==null?"其他":x[0],"value",x[1])).toList());}
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
  for(var table:scanTables.findAll()){
   if(table.getCreatedAt()==null) continue;
   var createdDate=table.getCreatedAt().atZone(ZoneId.systemDefault()).toLocalDate();
   var customer=Optional.ofNullable(table.getCustomerName()).orElse("未知客户");
   for(var row:table.getRows()){
    var isCompleted="COMPLETED".equalsIgnoreCase(row.getStatus());
    var detail=new LinkedHashMap<String,Object>(); detail.put("customerName",customer); detail.put("model",table.getModel()); detail.put("rowNumber",row.getRowNumber()); detail.put("machineSn",row.getMachineSn()==null?"":row.getMachineSn()); row.getValues().forEach(v -> detail.put(v.getFieldKey(), Optional.ofNullable(v.getFieldValue()).orElse("")));
    if(!createdDate.isBefore(weekStart)&&!createdDate.isAfter(today)){if(isCompleted){weekCompleted++;weekCompletedDevices.add(detail);}else{weekUnfinished++;weekUnfinishedDevices.add(detail);}}
    if(!createdDate.equals(today)) continue;
    (isCompleted?completed:unfinished).merge(customer,1L,Long::sum);
    (isCompleted?completedDevices:unfinishedDevices).add(detail);
   }
  }
  var zone=ZoneId.systemDefault(); var todayStart=today.atStartOfDay(zone).toInstant(); var tomorrowStart=today.plusDays(1).atStartOfDay(zone).toInstant(); var weekStartInstant=weekStart.atStartOfDay(zone).toInstant();
  var todayRepairs=lifecycle.findByEventTypeAndOccurredAtBetween("REPAIR_SWAP",todayStart,tomorrowStart);
  var weekRepairEvents=lifecycle.findByEventTypeAndOccurredAtBetween("REPAIR_SWAP",weekStartInstant,tomorrowStart);
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
  var overdue=orders.findBySlaDueAtBeforeAndStatusNotIn(Instant.now(),List.of(OrderStatus.CLOSED,OrderStatus.CANCELLED,OrderStatus.SUSPENDED,OrderStatus.SHIPPED)).stream().map(o->Map.of(
   "id",o.getId(),"order_number",o.getOrderNumber(),"machine_sn",o.getMachineSn()==null?"":o.getMachineSn(),
   "created_at",o.getCreatedAt(),"sla_due_at",o.getSlaDueAt())).toList();
  var recurring=lifecycle.recurringReplacementAlerts().stream().map(x->Map.of("machine_sn",x[0],"part",x[1]==null?"其他":x[1],"count",x[2])).toList();
  return Map.of("overdue",overdue,"recurring",recurring);
 }
}
