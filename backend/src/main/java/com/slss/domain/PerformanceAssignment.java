package com.slss.domain;

import jakarta.persistence.*;
import java.time.Instant;

/** A server-owned evaluation task.  The evaluator and subject are never inferred from request parameters. */
@Entity
@Table(name = "performance_assignments", uniqueConstraints = @UniqueConstraint(
    name = "uk_performance_assignment", columnNames = {"cycle_id", "template_id", "subject_user_id", "evaluator_user_id", "evaluation_mode"}))
public class PerformanceAssignment {
  @Id @GeneratedValue(strategy = GenerationType.IDENTITY) Long id;
  @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "cycle_id", nullable = false) PerformanceCycle cycle;
  @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "template_id", nullable = false) PerformanceTemplate template;
  @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "subject_user_id", nullable = false) User subject;
  @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "subject_department_id", nullable = false) PerformanceDepartment subjectDepartment;
  @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "evaluator_user_id", nullable = false) User evaluator;
  @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "evaluator_department_id") PerformanceDepartment evaluatorDepartment;
  @Column(name = "evaluation_mode", nullable = false) String evaluationMode = "subject";
  @Column(nullable = false) String status = "PENDING";
  @Column(name = "due_at") Instant dueAt;
  @OneToOne(fetch = FetchType.LAZY) @JoinColumn(name = "evaluation_id") PerformanceEvaluation evaluation;
  @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "created_by") User createdBy;
  @Version @Column(nullable = false) Long version = 0L;
  @Column(name = "created_at", nullable = false) Instant createdAt = Instant.now();
  @Column(name = "updated_at", nullable = false) Instant updatedAt = Instant.now();
  protected PerformanceAssignment() {}
  public PerformanceAssignment(PerformanceCycle cycle, PerformanceTemplate template, User subject,
      PerformanceDepartment subjectDepartment, User evaluator, PerformanceDepartment evaluatorDepartment, String mode) {
    this.cycle = cycle; this.template = template; this.subject = subject; this.subjectDepartment = subjectDepartment;
    this.evaluator = evaluator; this.evaluatorDepartment = evaluatorDepartment;
    this.evaluationMode = mode == null || mode.isBlank() ? "subject" : mode.trim().toLowerCase();
  }
  public Long getId() { return id; }
  public PerformanceCycle getCycle() { return cycle; }
  public PerformanceTemplate getTemplate() { return template; }
  public User getSubject() { return subject; }
  public PerformanceDepartment getSubjectDepartment() { return subjectDepartment; }
  public User getEvaluator() { return evaluator; }
  public PerformanceDepartment getEvaluatorDepartment() { return evaluatorDepartment; }
  public String getEvaluationMode() { return evaluationMode; }
  public String getStatus() { return status; }
  public void setStatus(String value) { status = value; }
  public Instant getDueAt() { return dueAt; }
  public void setDueAt(Instant value) { dueAt = value; }
  public PerformanceEvaluation getEvaluation() { return evaluation; }
  public void setEvaluation(PerformanceEvaluation value) { evaluation = value; }
  public Long getVersion() { return version; }
}
