package com.slss.service;
import com.slss.domain.OrderStatus; import com.slss.repository.RepairOrderRepository; import org.springframework.scheduling.annotation.Scheduled; import org.springframework.stereotype.Component; import java.time.Instant; import java.util.*;
@Component public class SlaMonitor { private final RepairOrderRepository orders; private final AuditService audit; private final Set<Long> alerted=new HashSet<>(); public SlaMonitor(RepairOrderRepository o,AuditService a){orders=o;audit=a;}
 @Scheduled(fixedDelayString="${slss.sla.scan-ms:60000}") public void scan(){var overdue=orders.findBySlaDueAtBeforeAndStatusNotIn(Instant.now(),List.of(OrderStatus.CLOSED,OrderStatus.CANCELLED,OrderStatus.SUSPENDED));for(var order:overdue)if(alerted.add(order.getId()))audit.record("system","SLA_OVERDUE","SERVICE_ORDER",String.valueOf(order.getId()),"工单超过 SLA 截止时间",null,false);}
}
