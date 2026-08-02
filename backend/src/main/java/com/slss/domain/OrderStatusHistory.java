package com.slss.domain;

import jakarta.persistence.*;
import java.time.Instant;

@Entity @Table(name="order_status_history")
public class OrderStatusHistory {
  @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
  @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="repair_order_id",nullable=false) private RepairOrder order;
  @Enumerated(EnumType.STRING) @Column(name="from_status") private OrderStatus fromStatus;
  @Enumerated(EnumType.STRING) @Column(name="to_status",nullable=false) private OrderStatus toStatus;
  private String reason;
  @Column(name="operated_by") private String operatedBy;
  @Column(name="created_at",nullable=false) private Instant createdAt=Instant.now();
  public Long getId(){return id;} public OrderStatus getFromStatus(){return fromStatus;} public OrderStatus getToStatus(){return toStatus;} public String getReason(){return reason;} public String getOperatedBy(){return operatedBy;} public Instant getCreatedAt(){return createdAt;}
  public void setOrder(RepairOrder v){order=v;} public void setFromStatus(OrderStatus v){fromStatus=v;} public void setToStatus(OrderStatus v){toStatus=v;} public void setReason(String v){reason=v;} public void setOperatedBy(String v){operatedBy=v;}
}
