package com.slss.service;

import java.util.Map;
import java.util.Set;
import com.slss.domain.OrderStatus;

public final class OrderWorkflow {
  private OrderWorkflow() {}
  private static final Map<OrderStatus, Set<OrderStatus>> ALLOWED = Map.of(
      OrderStatus.PENDING, Set.of(OrderStatus.ASSIGNED, OrderStatus.CANCELLED),
      OrderStatus.ASSIGNED, Set.of(OrderStatus.CHECKING, OrderStatus.SUSPENDED, OrderStatus.CANCELLED),
      OrderStatus.CHECKING, Set.of(OrderStatus.QA_AGING, OrderStatus.SUSPENDED, OrderStatus.CANCELLED),
      OrderStatus.QA_AGING, Set.of(OrderStatus.SHIPPED, OrderStatus.SUSPENDED, OrderStatus.CANCELLED),
      OrderStatus.SHIPPED, Set.of(OrderStatus.CLOSED, OrderStatus.SUSPENDED),
      OrderStatus.SUSPENDED, Set.of(OrderStatus.ASSIGNED, OrderStatus.CHECKING, OrderStatus.CANCELLED),
      OrderStatus.CLOSED, Set.of(),
      OrderStatus.CANCELLED, Set.of());
  public static boolean canTransition(OrderStatus from, OrderStatus to) {
    return ALLOWED.getOrDefault(from, Set.of()).contains(to);
  }
}
