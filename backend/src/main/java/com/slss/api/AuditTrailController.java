package com.slss.api;

import com.slss.repository.*;
import java.time.Instant;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
@PreAuthorize("hasAnyAuthority('PERM_VIEW_ORDERS','PERM_MANAGE_ORDERS','PERM_VIEW_PRODUCTION','PERM_MANAGE_PRODUCTION')")
public class AuditTrailController {
  private final AssetRepository assets;
  private final LifecycleEventRepository lifecycle;
  private final OrderStatusHistoryRepository history;
  public AuditTrailController(AssetRepository assets,LifecycleEventRepository lifecycle,OrderStatusHistoryRepository history){this.assets=assets;this.lifecycle=lifecycle;this.history=history;}

  @GetMapping("/assets/{machineSn}/lifecycle")
  @Transactional(readOnly = true)
  public Object lifecycle(@PathVariable String machineSn) {
    var asset = assets.findByMachineSnIgnoreCase(machineSn).orElseThrow();
    return lifecycle.findByAssetIdOrderByOccurredAtAsc(asset.getId()).stream()
        .map(event -> new LifecycleResponse(
            event.getId(),
            event.getEventType(),
            event.getPartName(),
            event.getOldSn(),
            event.getNewSn(),
            event.getDetails(),
            event.getFaultDescription(),
            operatorFrom(event.getDetails()),
            event.getOccurredAt()))
        .toList();
  }

  private String operatorFrom(String details) {
    if (details == null) return null;
    var marker = details.indexOf("维修员：");
    if (marker < 0) marker = details.indexOf("维修员:");
    if (marker < 0) return null;
    var start = marker + (details.charAt(marker + 3) == '：' ? 4 : 3);
    var value = details.substring(start).trim();
    return value.isBlank() ? null : value;
  }

  @GetMapping("/service-orders/{id}/status-history")
  @Transactional(readOnly = true)
  public Object history(@PathVariable Long id) {
    return history.findByOrderIdOrderByCreatedAtAsc(id).stream()
        .map(event -> new StatusHistoryResponse(
            event.getId(),
            event.getFromStatus() == null ? null : event.getFromStatus().name(),
            event.getToStatus().name(),
            event.getReason(),
            event.getOperatedBy(),
            event.getCreatedAt()))
        .toList();
  }

  public record LifecycleResponse(
      Long id,
      String eventType,
      String partName,
      String oldSn,
      String newSn,
      String details,
      String faultDescription,
      String operatorNo,
      Instant occurredAt) {}

  public record StatusHistoryResponse(
      Long id,
      String fromStatus,
      String toStatus,
      String reason,
      String operatedBy,
      Instant createdAt) {}
}
