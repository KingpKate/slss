package com.slss.repository;

import com.slss.domain.PerformanceGradeRule;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;

public interface PerformanceGradeRuleRepository extends JpaRepository<PerformanceGradeRule, Long> {
  List<PerformanceGradeRule> findByActiveTrueOrderByMinScoreDesc();
}
