package com.slss.repository;
import com.slss.domain.ProcurementProject; import org.springframework.data.jpa.repository.JpaRepository; import java.util.Optional;
public interface ProcurementProjectRepository extends JpaRepository<ProcurementProject,Long>{Optional<ProcurementProject> findByInitiation_Id(Long id);}
