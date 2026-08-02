package com.slss.repository;
import com.slss.domain.RepairPart; import org.springframework.data.jpa.repository.JpaRepository; import java.util.List;
public interface RepairPartRepository extends JpaRepository<RepairPart,Long>{List<RepairPart> findByOrderId(Long id);}
