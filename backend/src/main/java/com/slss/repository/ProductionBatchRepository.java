package com.slss.repository;
import com.slss.domain.ProductionBatch; import org.springframework.data.jpa.repository.JpaRepository; import java.util.Optional;
public interface ProductionBatchRepository extends JpaRepository<ProductionBatch,Long>{Optional<ProductionBatch> findByBatchName(String name);}
