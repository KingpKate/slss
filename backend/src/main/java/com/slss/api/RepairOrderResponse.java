package com.slss.api;

import com.slss.domain.OrderStatus;
import com.slss.domain.RepairOrder;
import java.time.Instant;
import java.time.OffsetDateTime;

public record RepairOrderResponse(
    Long id, String orderNumber, String customerName, String faultDescription,
    OrderStatus status, String machineSn, Long assignedTo, Instant slaDueAt,
    Instant slaPausedAt, Long slaRemainingSeconds, Long version,
    OffsetDateTime createdAt, OffsetDateTime updatedAt,
    String discoveryPhase, String actualFaultDescription,
    String shipmentConfigJson, String receivedConfigJson, String reportDataJson,
    String trackingNumber, String shipmentModel) {
  public static RepairOrderResponse from(RepairOrder order) {
    return from(order, null);
  }
  public static RepairOrderResponse from(RepairOrder order, String shipmentModel) {
    return new RepairOrderResponse(order.getId(), order.getOrderNumber(), order.getCustomerName(),
        order.getFaultDescription(), order.getStatus(), order.getMachineSn(), order.getAssignedTo(),
        order.getSlaDueAt(), order.getSlaPausedAt(), order.getSlaRemainingSeconds(),
        order.getVersion(), order.getCreatedAt(), order.getUpdatedAt(),
        order.getDiscoveryPhase(), order.getActualFaultDescription(),
        order.getShipmentConfigJson(), order.getReceivedConfigJson(), order.getReportDataJson(),
        order.getTrackingNumber(), shipmentModel);
  }
}
