package com.slss.repository;
import com.slss.domain.RepairOrder;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import java.util.Optional;
public interface RepairOrderRepository extends JpaRepository<RepairOrder,Long> { Optional<RepairOrder> findByOrderNumber(String orderNumber); long countByStatus(com.slss.domain.OrderStatus status); java.util.List<RepairOrder> findByMachineSnIgnoreCaseOrderByCreatedAtDesc(String machineSn); java.util.List<RepairOrder> findBySlaDueAtBeforeAndStatusNotIn(java.time.Instant due, java.util.Collection<com.slss.domain.OrderStatus> statuses); @Query("select r.customerName,count(r) from RepairOrder r group by r.customerName order by count(r) desc") java.util.List<Object[]> customerStatistics(); }
