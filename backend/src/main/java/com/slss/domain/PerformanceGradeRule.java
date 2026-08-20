package com.slss.domain;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "performance_grade_rules")
public class PerformanceGradeRule {
  @Id @GeneratedValue(strategy = GenerationType.IDENTITY) Long id;
  @Column(name="grade_code", nullable=false, unique=true) String gradeCode;
  @Column(name="grade_label", nullable=false) String gradeLabel;
  @Column(name="min_score", nullable=false) BigDecimal minScore;
  @Column(name="max_score") BigDecimal maxScore;
  @Column(name="reward_adjustment") BigDecimal rewardAdjustment;
  @Column(nullable=false) boolean active = true;
  @Version @Column(nullable=false) Long version = 0L;
  @Column(name="updated_at", nullable=false) Instant updatedAt = Instant.now();
  protected PerformanceGradeRule() {}
  public Long getId(){return id;} public String getGradeCode(){return gradeCode;} public String getGradeLabel(){return gradeLabel;}
  public BigDecimal getMinScore(){return minScore;} public BigDecimal getMaxScore(){return maxScore;} public BigDecimal getRewardAdjustment(){return rewardAdjustment;}
  public boolean isActive(){return active;} public Long getVersion(){return version;}
  public void setGradeLabel(String v){gradeLabel=v;} public void setMinScore(BigDecimal v){minScore=v;} public void setMaxScore(BigDecimal v){maxScore=v;}
  public void setRewardAdjustment(BigDecimal v){rewardAdjustment=v;} public void setActive(boolean v){active=v;}
}
