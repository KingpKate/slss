package com.slss.repository;
import com.slss.domain.RepairReport; import org.springframework.data.jpa.repository.JpaRepository; import java.util.Optional;
public interface RepairReportRepository extends JpaRepository<RepairReport,Long>{Optional<RepairReport> findByOrderId(Long id);}
