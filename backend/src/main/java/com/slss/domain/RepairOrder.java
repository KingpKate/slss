package com.slss.domain;
import jakarta.persistence.*;
import java.time.OffsetDateTime; import java.time.Instant;
@Entity @Table(name="repair_orders")
public class RepairOrder {
  @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
  @Column(name="order_number", nullable=false, unique=true) private String orderNumber;
  @Column(name="customer_name", nullable=false) private String customerName;
  @Column(name="fault_description", nullable=false, columnDefinition="TEXT") private String faultDescription;
  @Enumerated(EnumType.STRING) @Column(nullable=false) private OrderStatus status = OrderStatus.PENDING;
  @Column(name="machine_sn") private String machineSn;
  @Column(name="assigned_to") private Long assignedTo;
  @Column(name="sla_due_at") private Instant slaDueAt;
  @Column(name="sla_paused_at") private Instant slaPausedAt;
  @Column(name="sla_remaining_seconds") private Long slaRemainingSeconds;
  @Version @Column(nullable=false) private Long version=0L;
  @Column(name="updated_at",nullable=false) private OffsetDateTime updatedAt=OffsetDateTime.now();
  @Column(name="created_at", nullable=false) private OffsetDateTime createdAt = OffsetDateTime.now();
  @Column(name="discovery_phase") private String discoveryPhase;
  @Column(name="actual_fault_description", columnDefinition="TEXT") private String actualFaultDescription;
  @Column(name="shipment_config_json", columnDefinition="json") private String shipmentConfigJson;
  @Column(name="received_config_json", columnDefinition="json") private String receivedConfigJson;
  @Column(name="report_data_json", columnDefinition="json") private String reportDataJson;
  @Column(name="tracking_number") private String trackingNumber;
  @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="tenant_id") private CustomerTenant tenant;
  public CustomerTenant getTenant(){return tenant;} public void setTenant(CustomerTenant v){tenant=v;}
  public Long getId(){return id;} public String getOrderNumber(){return orderNumber;} public void setOrderNumber(String v){orderNumber=v;} public String getCustomerName(){return customerName;} public void setCustomerName(String v){customerName=v;} public String getFaultDescription(){return faultDescription;} public void setFaultDescription(String v){faultDescription=v;} public OrderStatus getStatus(){return status;} public void setStatus(OrderStatus v){status=v;} public String getMachineSn(){return machineSn;} public void setMachineSn(String v){machineSn=v;} public OffsetDateTime getCreatedAt(){return createdAt;} public Long getAssignedTo(){return assignedTo;} public void setAssignedTo(Long v){assignedTo=v;} public Instant getSlaDueAt(){return slaDueAt;} public void setSlaDueAt(Instant v){slaDueAt=v;} public Instant getSlaPausedAt(){return slaPausedAt;} public void setSlaPausedAt(Instant v){slaPausedAt=v;} public Long getSlaRemainingSeconds(){return slaRemainingSeconds;} public void setSlaRemainingSeconds(Long v){slaRemainingSeconds=v;} public Long getVersion(){return version;} public OffsetDateTime getUpdatedAt(){return updatedAt;} public String getDiscoveryPhase(){return discoveryPhase;} public void setDiscoveryPhase(String v){discoveryPhase=v;} public String getActualFaultDescription(){return actualFaultDescription;} public void setActualFaultDescription(String v){actualFaultDescription=v;} public String getShipmentConfigJson(){return shipmentConfigJson;} public void setShipmentConfigJson(String v){shipmentConfigJson=v;} public String getReceivedConfigJson(){return receivedConfigJson;} public void setReceivedConfigJson(String v){receivedConfigJson=v;} public String getReportDataJson(){return reportDataJson;} public void setReportDataJson(String v){reportDataJson=v;} public String getTrackingNumber(){return trackingNumber;} public void setTrackingNumber(String v){trackingNumber=v;}
}
