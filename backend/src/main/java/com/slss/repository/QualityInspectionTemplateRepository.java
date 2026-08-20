package com.slss.repository;
import com.slss.domain.QualityInspectionTemplate; import org.springframework.data.jpa.repository.JpaRepository; import java.util.*;
public interface QualityInspectionTemplateRepository extends JpaRepository<QualityInspectionTemplate,Long>{ List<QualityInspectionTemplate> findByActiveTrueOrderByCreatedAtDesc(); Optional<QualityInspectionTemplate> findByCustomerNameIgnoreCaseAndDispatchOrderNoIgnoreCase(String customer,String dispatch); }
