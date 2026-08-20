package com.slss.repository;
import com.slss.domain.PerformanceScore;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;
public interface PerformanceScoreRepository extends JpaRepository<PerformanceScore,Long>{ Optional<PerformanceScore> findByEvaluation_IdAndItem_IdAndEvaluator_Id(Long evaluationId,Long itemId,Long evaluatorId); }
