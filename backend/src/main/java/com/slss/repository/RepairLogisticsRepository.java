package com.slss.repository;
import com.slss.domain.RepairLogistics; import org.springframework.data.jpa.repository.JpaRepository; import java.util.List;
public interface RepairLogisticsRepository extends JpaRepository<RepairLogistics,Long>{List<RepairLogistics> findByOrderId(Long id);}
