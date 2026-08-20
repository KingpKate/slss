package com.slss.repository;
import com.slss.domain.PerformanceEvaluation;
import org.springframework.data.jpa.repository.*;
import java.util.*;
public interface PerformanceEvaluationRepository extends JpaRepository<PerformanceEvaluation,Long>{
 Optional<PerformanceEvaluation> findByCycle_IdAndTemplate_IdAndSubject_Id(Long cycleId,Long templateId,Long subjectId);
 Optional<PerformanceEvaluation> findByCycle_IdAndTemplate_IdAndSubject_IdAndEvaluator_IdAndEvaluationMode(Long cycleId,Long templateId,Long subjectId,Long evaluatorId,String evaluationMode);
 List<PerformanceEvaluation> findByCycle_PeriodCodeOrderBySubjectDepartment_NameAscSubject_UsernameAsc(String periodCode);
}
