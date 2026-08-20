package com.slss.repository;
import com.slss.domain.PerformanceCycle;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;
public interface PerformanceCycleRepository extends JpaRepository<PerformanceCycle,Long>{ Optional<PerformanceCycle> findByPeriodCodeAndStatus(String periodCode,String status); }
