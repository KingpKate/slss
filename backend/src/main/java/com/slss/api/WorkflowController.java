package com.slss.api;

import com.slss.domain.OrderStatus; import com.slss.domain.RepairOrder; import com.slss.repository.RepairOrderRepository; import com.slss.service.RepairOrderService; import com.slss.service.TenantScopeService;
import com.slss.service.OrderWorkflow;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.security.access.prepost.PreAuthorize;

@RestController
@RequestMapping("/api/v1/service-orders")
public class WorkflowController {
  private final RepairOrderService service; private final RepairOrderRepository orders; private final TenantScopeService tenantScope; public WorkflowController(RepairOrderService service,RepairOrderRepository orders,TenantScopeService tenantScope){this.service=service;this.orders=orders;this.tenantScope=tenantScope;}
  private void requireAccess(Long id){ tenantScope.requireAccess(orders.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,"工单不存在")).getTenant()); }
  public record TransitionRequest(@NotNull OrderStatus targetStatus, String reason) {}
  public record AssignmentRequest(@NotNull Long userId, Long slaHours, String reason) {}
  public record SlaExtensionRequest(@NotNull Long hours, String reason) {}
  public record TransitionResponse(Long orderId, OrderStatus from, OrderStatus to, String reason) {}

  @PostMapping("/{id}/transitions") @PreAuthorize("hasAuthority('PERM_MANAGE_ORDERS')")
  public TransitionResponse transition(@PathVariable Long id, @Valid @RequestBody TransitionRequest request) {
    requireAccess(id);
    var from = service.getCurrentStatus(id);
    var updated = service.transition(id, request.targetStatus(), request.reason());
    return new TransitionResponse(id, from, updated.getStatus(), request.reason());
  }
  @PostMapping("/{id}/assignment") @PreAuthorize("hasAuthority('PERM_MANAGE_ORDERS')")
  public RepairOrderResponse assign(@PathVariable Long id,@Valid @RequestBody AssignmentRequest r){requireAccess(id);return RepairOrderResponse.from(service.assign(id,r.userId(),java.time.Duration.ofHours(r.slaHours()==null?72:r.slaHours()),r.reason()));}
  @PostMapping("/{id}/sla/extensions") @PreAuthorize("hasAuthority('PERM_MANAGE_ORDERS')")
  public RepairOrderResponse extendSla(@PathVariable Long id,@Valid @RequestBody SlaExtensionRequest r){requireAccess(id);return RepairOrderResponse.from(service.extendSla(id,java.time.Duration.ofHours(r.hours()),r.reason()));}
}
