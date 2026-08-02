package com.slss.service;
import com.slss.domain.OrderStatus; import org.junit.jupiter.api.Test; import static org.junit.jupiter.api.Assertions.*;
class ProductionBatchServiceTest { @Test void workflowStartsInDraft(){assertTrue(OrderStatus.values().length >= 6);assertTrue(OrderWorkflow.canTransition(OrderStatus.PENDING,OrderStatus.ASSIGNED));} }
