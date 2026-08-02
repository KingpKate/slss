package com.slss.service;
import com.slss.domain.OrderStatus; import org.junit.jupiter.api.Test; import static org.junit.jupiter.api.Assertions.*;
class OrderWorkflowTest { @Test void allowsOnlyForwardTransitions(){assertTrue(OrderWorkflow.canTransition(OrderStatus.CHECKING,OrderStatus.QA_AGING));assertFalse(OrderWorkflow.canTransition(OrderStatus.CLOSED,OrderStatus.CHECKING));assertFalse(OrderWorkflow.canTransition(OrderStatus.PENDING,OrderStatus.CLOSED));} }
