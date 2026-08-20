package com.slss.repository;
import com.slss.domain.PerformanceTemplate;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import java.util.*;
public interface PerformanceTemplateRepository extends JpaRepository<PerformanceTemplate,Long>{
 @Query("select t from PerformanceTemplate t join fetch t.department d where t.status='ACTIVE' and d.code=:code order by t.templateVersion desc") List<PerformanceTemplate> findActiveForDepartment(@Param("code") String code);
 Optional<PerformanceTemplate> findFirstByDepartment_IdAndStatusOrderByTemplateVersionDesc(Long departmentId,String status);
 @Query("select t from PerformanceTemplate t join fetch t.department d order by d.name asc, t.templateVersion desc") List<PerformanceTemplate> findAllForAdmin();
 boolean existsByDepartment_IdAndNameAndTemplateVersion(Long departmentId,String name,int templateVersion);
}
