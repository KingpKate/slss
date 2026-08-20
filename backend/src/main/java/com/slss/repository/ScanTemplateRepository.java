package com.slss.repository;
import com.slss.domain.ScanTemplate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import java.util.*;
public interface ScanTemplateRepository extends JpaRepository<ScanTemplate,Long>{
 List<ScanTemplate> findByTenantIsNullAndCustomerNameIgnoreCase(String customerName);
 Optional<ScanTemplate> findByActiveTrueAndCustomerNameIgnoreCaseAndModelIgnoreCase(String customerName,String model);
 List<ScanTemplate> findByActiveTrueOrderByCustomerNameAscModelAsc();
 Page<ScanTemplate> findByActiveTrue(Pageable pageable);
 Page<ScanTemplate> findByActiveTrueAndTenant_IdIn(java.util.Collection<Long> tenantIds, Pageable pageable);
 Page<ScanTemplate> findByActiveTrueAndTenantIsNull(Pageable pageable);
}
