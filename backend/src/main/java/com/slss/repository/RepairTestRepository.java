package com.slss.repository;
import com.slss.domain.RepairTest; import org.springframework.data.jpa.repository.JpaRepository; import java.util.List;
public interface RepairTestRepository extends JpaRepository<RepairTest,Long>{List<RepairTest> findByOrderId(Long id);}
