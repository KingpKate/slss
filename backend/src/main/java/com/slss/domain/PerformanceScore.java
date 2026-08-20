package com.slss.domain;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;

@Entity @Table(name="performance_scores")
public class PerformanceScore {
  @Id @GeneratedValue(strategy=GenerationType.IDENTITY) Long id;
  @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="evaluation_id",nullable=false) PerformanceEvaluation evaluation;
  @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="item_id",nullable=false) PerformanceItem item;
  @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="evaluator_user_id",nullable=false) User evaluator;
  @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="evaluator_department_id",nullable=false) PerformanceDepartment evaluatorDepartment;
  @Column(nullable=false) BigDecimal score;
  @Column(name="monthly_score") BigDecimal monthlyScore;
  @Column(name="score_type",nullable=false) String scoreType="SUBJECT";
  @Column(length=1000) String comment;
  @Column(name="signed_at") Instant signedAt;
  @Version @Column(nullable=false) Long version=0L;
  protected PerformanceScore() {}
  public PerformanceScore(PerformanceEvaluation e,PerformanceItem i,User u,PerformanceDepartment d,BigDecimal s,String c){evaluation=e;item=i;evaluator=u;evaluatorDepartment=d;score=s;comment=c;}
  public PerformanceItem getItem(){return item;} public BigDecimal getScore(){return score;} public BigDecimal getMonthlyScore(){return monthlyScore;} public String getScoreType(){return scoreType;} public String getComment(){return comment;} public Long getId(){return id;} public void setScore(BigDecimal v){score=v;} public void setMonthlyScore(BigDecimal v){monthlyScore=v;} public void setScoreType(String v){scoreType=v;} public void setComment(String v){comment=v;} public User getEvaluator(){return evaluator;}
}
