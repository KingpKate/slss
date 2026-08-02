package com.slss.api;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.slss.service.TenantScopeService;
import com.slss.domain.*; import com.slss.repository.*; import com.slss.service.RepairOrderService; import org.springframework.beans.factory.annotation.Value; import org.springframework.security.access.prepost.PreAuthorize; import org.springframework.security.core.context.SecurityContextHolder; import org.springframework.web.bind.annotation.*; import org.springframework.http.*; import javax.crypto.Mac; import javax.crypto.spec.SecretKeySpec; import java.nio.charset.StandardCharsets; import java.time.Instant; import java.util.*; import java.security.MessageDigest;
@RestController @RequestMapping("/api/v1/service-orders/{orderId}") @PreAuthorize("hasAuthority('PERM_MANAGE_ORDERS')")
public class RepairExtensionController {
 final RepairOrderRepository orders; final RepairPartRepository parts; final RepairTestRepository tests; final RepairLogisticsRepository logistics; final RepairReportRepository reports; final RepairOrderService workflow; final ObjectMapper mapper; final String reportDownloadSecret; final TenantScopeService tenantScope;
 public RepairExtensionController(RepairOrderRepository o,RepairPartRepository p,RepairTestRepository t,RepairLogisticsRepository l,RepairReportRepository r,RepairOrderService w,ObjectMapper m,@Value("${slss.security.report-download-secret}") String rds,TenantScopeService ts){orders=o;parts=p;tests=t;logistics=l;reports=r;workflow=w;mapper=m;reportDownloadSecret=rds;tenantScope=ts;}
 private RepairOrder order(Long id){var value=orders.findById(id).orElseThrow();tenantScope.requireAccess(value.getTenant());return value;}
 public record PartRequest(String partName,String oldSn,String newSn){} public record TestRequest(String testType,String result,String details){} public record LogisticsRequest(String direction,String carrier,String trackingNumber,String notes){} public record ReportRequest(String diagnosis,String resolution,String testConclusion){}
 @GetMapping("/parts") public List<RepairPart> parts(@PathVariable Long orderId){order(orderId);return parts.findByOrderId(orderId);}
 @PostMapping("/parts") public RepairPart addPart(@PathVariable Long orderId,@RequestBody PartRequest r){return workflow.replacePart(orderId,r.partName(),r.oldSn(),r.newSn());}
 @GetMapping("/tests") public List<RepairTest> tests(@PathVariable Long orderId){order(orderId);return tests.findByOrderId(orderId);}
 @PostMapping("/tests") public RepairTest addTest(@PathVariable Long orderId,@RequestBody TestRequest r){var t=new RepairTest();t.setOrder(order(orderId));t.setTestType(r.testType());t.setResult(r.result());t.setDetails(r.details());return tests.save(t);}
 @GetMapping("/logistics") public List<RepairLogistics> logistics(@PathVariable Long orderId){order(orderId);return logistics.findByOrderId(orderId);}
 @PostMapping("/logistics") public RepairLogistics addLogistics(@PathVariable Long orderId,@RequestBody LogisticsRequest r){var l=new RepairLogistics();l.setOrder(order(orderId));l.setDirection(r.direction());l.setCarrier(r.carrier());l.setTrackingNumber(r.trackingNumber());l.setNotes(r.notes());return logistics.save(l);}
 @GetMapping("/report") public RepairReport report(@PathVariable Long orderId){order(orderId);return reports.findByOrderId(orderId).orElseThrow();}
 @PutMapping("/report") @org.springframework.transaction.annotation.Transactional public RepairReport saveReport(@PathVariable Long orderId,@RequestBody ReportRequest r){var o=order(orderId);var x=reports.findByOrderId(orderId).orElseGet(RepairReport::new);x.setOrder(o);x.setDiagnosis(r.diagnosis());x.setResolution(r.resolution());x.setTestConclusion(r.testConclusion());var saved=reports.save(x);try{var data=new LinkedHashMap<String,Object>();data.put("diagnosis",saved.getDiagnosis());data.put("resolution",saved.getResolution());data.put("testConclusion",saved.getTestConclusion());data.put("updatedAt",Instant.now().toString());o.setReportDataJson(mapper.writeValueAsString(data));orders.save(o);}catch(Exception ex){throw new IllegalStateException("维修报告同步到工单失败",ex);}return saved;}
 @PostMapping("/report/download-token") public Map<String,Object> downloadToken(@PathVariable Long orderId,@RequestParam(defaultValue="300") long ttl){order(orderId);long exp=Instant.now().getEpochSecond()+Math.min(Math.max(ttl,60),900);String payload=orderId+":"+exp+":"+actor();return Map.of("token",payload+"."+sign(payload),"expiresAt",exp);}
 @GetMapping("/report/download") public ResponseEntity<byte[]> download(@PathVariable Long orderId,@RequestParam String token){
  order(orderId);
  var p=token.split("\\.",2);
  if(p.length!=2)throw new org.springframework.web.server.ResponseStatusException(HttpStatus.FORBIDDEN,"下载令牌无效或已过期");
  var parts=p[0].split(":",3);
  boolean valid=false; try { valid=parts.length==3&&parts[0].equals(String.valueOf(orderId))&&parts[2].equals(actor())&&MessageDigest.isEqual(p[1].getBytes(StandardCharsets.US_ASCII),sign(p[0]).getBytes(StandardCharsets.US_ASCII))&&Long.parseLong(parts[1])>=Instant.now().getEpochSecond(); } catch (RuntimeException ignored) { valid=false; }
  if(!valid)throw new org.springframework.web.server.ResponseStatusException(HttpStatus.FORBIDDEN,"下载令牌无效或已过期");
  var r=reports.findByOrderId(orderId).orElseThrow();String body="SLSS维修报告\n诊断："+r.getDiagnosis()+"\n处理："+r.getResolution()+"\n测试结论："+r.getTestConclusion();return ResponseEntity.ok().contentType(MediaType.TEXT_PLAIN).header(HttpHeaders.CONTENT_DISPOSITION,"attachment; filename=repair-report-"+orderId+".txt").body(body.getBytes(StandardCharsets.UTF_8));
 }
 private String actor(){var a=SecurityContextHolder.getContext().getAuthentication();return a==null?"system":a.getName();}
 private String sign(String payload){try{var mac=Mac.getInstance("HmacSHA256");mac.init(new SecretKeySpec(reportDownloadSecret.getBytes(StandardCharsets.UTF_8),"HmacSHA256"));return java.util.HexFormat.of().formatHex(mac.doFinal(payload.getBytes(StandardCharsets.UTF_8)));}catch(Exception e){throw new IllegalStateException(e);}}
}
