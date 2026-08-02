package com.slss.repository;
import com.slss.domain.ProductionImportFailure; import org.springframework.data.jpa.repository.JpaRepository; import java.util.List;
public interface ProductionImportFailureRepository extends JpaRepository<ProductionImportFailure,Long>{List<ProductionImportFailure> findByJobIdOrderByRowNumberAsc(Long jobId);}
