package com.slss.repository;
import com.slss.domain.SoftwareRequirement; import org.springframework.data.jpa.repository.JpaRepository; import java.util.List;
public interface SoftwareRequirementRepository extends JpaRepository<SoftwareRequirement,Long>{List<SoftwareRequirement> findByInitiation_Id(Long id); void deleteByIdAndInitiation_Id(Long id,Long initiationId);}
