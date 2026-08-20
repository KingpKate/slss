package com.slss.domain;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;

@Entity @Table(name="performance_evaluations")
public class PerformanceEvaluation {
  @Id @GeneratedValue(strategy=GenerationType.IDENTITY) Long id;
  @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="cycle_id",nullable=false) PerformanceCycle cycle;
  @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="template_id",nullable=false) PerformanceTemplate template;
  @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="subject_user_id",nullable=false) User subject;
  @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="subject_department_id",nullable=false) PerformanceDepartment subjectDepartment;
  @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="evaluator_user_id") User evaluator;
  @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="evaluator_department_id") PerformanceDepartment evaluatorDepartment;
  @Column(name="evaluation_mode",nullable=false) String evaluationMode="subject";
  @Column(nullable=false) String status="DRAFT";
  @Column(name="raw_score") BigDecimal rawScore;
  @Column(name="normalized_score") BigDecimal normalizedScore;
  @Column(name="grade_code") String gradeCode;
  @Column(name="reward_adjustment") BigDecimal rewardAdjustment;
  @Column(name="visible_weight") BigDecimal visibleWeight;
  @Column(name="submitted_at") Instant submittedAt;
  @Column(name="signature_hash") String signatureHash;
  @Column(name="self_comment",length=2000) String selfComment;
  @Column(name="good_deeds",length=2000) String goodDeeds;
  @Column(name="remarks",length=2000) String remarks;
  @Version @Column(nullable=false) Long version=0L;
  @OneToMany(mappedBy="evaluation",cascade=CascadeType.ALL,orphanRemoval=true) List<PerformanceScore> scores=new ArrayList<>();
  protected PerformanceEvaluation() {}
  public PerformanceEvaluation(PerformanceCycle c,PerformanceTemplate t,User u,PerformanceDepartment d){cycle=c;template=t;subject=u;subjectDepartment=d;}
  public Long getId(){return id;} public PerformanceCycle getCycle(){return cycle;} public PerformanceTemplate getTemplate(){return template;} public User getSubject(){return subject;} public PerformanceDepartment getSubjectDepartment(){return subjectDepartment;} public User getEvaluator(){return evaluator;} public PerformanceDepartment getEvaluatorDepartment(){return evaluatorDepartment;} public String getEvaluationMode(){return evaluationMode;} public void setEvaluationMode(String v){evaluationMode=v;} public void setEvaluator(User v){evaluator=v;} public void setEvaluatorDepartment(PerformanceDepartment v){evaluatorDepartment=v;} public String getStatus(){return status;} public void setStatus(String v){status=v;} public BigDecimal getRawScore(){return rawScore;} public void setRawScore(BigDecimal v){rawScore=v;} public BigDecimal getNormalizedScore(){return normalizedScore;} public void setNormalizedScore(BigDecimal v){normalizedScore=v;} public BigDecimal getVisibleWeight(){return visibleWeight;} public void setVisibleWeight(BigDecimal v){visibleWeight=v;} public Long getVersion(){return version;} public List<PerformanceScore> getScores(){return scores;} public void submit(String hash){status="SUBMITTED";signatureHash=hash;submittedAt=Instant.now();}
  public String getGradeCode(){return gradeCode;} public void setGradeCode(String v){gradeCode=v;} public BigDecimal getRewardAdjustment(){return rewardAdjustment;} public void setRewardAdjustment(BigDecimal v){rewardAdjustment=v;}
  public String getSelfComment(){return selfComment;} public void setSelfComment(String v){selfComment=v;} public String getGoodDeeds(){return goodDeeds;} public void setGoodDeeds(String v){goodDeeds=v;} public String getRemarks(){return remarks;} public void setRemarks(String v){remarks=v;}
}
