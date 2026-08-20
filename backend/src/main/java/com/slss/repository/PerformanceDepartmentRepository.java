package com.slss.repository;
import com.slss.domain.PerformanceDepartment;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;
public interface PerformanceDepartmentRepository extends JpaRepository<PerformanceDepartment,Long>{ Optional<PerformanceDepartment> findByCodeAndStatus(String code,String status); Optional<PerformanceDepartment> findByNameAndStatus(String name,String status); }
