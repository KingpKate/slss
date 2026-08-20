package com.slss.repository;

import com.slss.domain.PerformanceAssignment;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PerformanceAssignmentRepository extends JpaRepository<PerformanceAssignment, Long> {
  Optional<PerformanceAssignment> findByEvaluation_Id(Long evaluationId);
  Optional<PerformanceAssignment> findByCycle_IdAndTemplate_IdAndSubject_IdAndEvaluator_IdAndEvaluationMode(
      Long cycleId, Long templateId, Long subjectId, Long evaluatorId, String mode);
  List<PerformanceAssignment> findByEvaluator_IdAndCycle_PeriodCodeOrderByDueAtAsc(Long evaluatorId, String period);
  List<PerformanceAssignment> findBySubject_IdAndCycle_PeriodCodeOrderByDueAtAsc(Long subjectId, String period);
  List<PerformanceAssignment> findByCycle_PeriodCodeOrderByDueAtAsc(String period);
}
