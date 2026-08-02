package com.slss.repository;
import com.slss.domain.ServerRequirement; import org.springframework.data.jpa.repository.JpaRepository; import java.util.List;
public interface ServerRequirementRepository extends JpaRepository<ServerRequirement,Long>{List<ServerRequirement> findByInitiation_Id(Long id); void deleteByIdAndInitiation_Id(Long id,Long initiationId);}
