package com.slss.repository;
import com.slss.domain.OrderStatusHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
public interface OrderStatusHistoryRepository extends JpaRepository<OrderStatusHistory,Long>{List<OrderStatusHistory> findByOrderIdOrderByCreatedAtAsc(Long orderId);}
