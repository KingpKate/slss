package com.slss.repository;
import com.slss.domain.ScanTemplate;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;
public interface ScanTemplateRepository extends JpaRepository<ScanTemplate,Long>{Optional<ScanTemplate> findByActiveTrueAndCustomerNameIgnoreCaseAndModelIgnoreCase(String customerName,String model); List<ScanTemplate> findByActiveTrueOrderByCustomerNameAscModelAsc();}
