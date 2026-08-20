package com.slss.service;

import com.slss.domain.*;
import com.slss.repository.*;
import java.time.Instant;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/** Application service for server-created evaluation tasks. */
@Service
public class PerformanceAssignmentService {
  private final UserRepository users;
  private final UserDepartmentMembershipRepository memberships;
  private final PerformanceDepartmentRepository departments;
  private final PerformanceCycleRepository cycles;
  private final PerformanceTemplateRepository templates;
  private final PerformanceAssignmentRepository assignments;
  private final PerformanceEvaluationRepository evaluations;

  public PerformanceAssignmentService(UserRepository users, UserDepartmentMembershipRepository memberships,
      PerformanceDepartmentRepository departments, PerformanceCycleRepository cycles,
      PerformanceTemplateRepository templates, PerformanceAssignmentRepository assignments,
      PerformanceEvaluationRepository evaluations) {
    this.users=users; this.memberships=memberships; this.departments=departments; this.cycles=cycles;
    this.templates=templates; this.assignments=assignments; this.evaluations=evaluations;
  }

  @Transactional(readOnly=true)
  public List<PerformanceAssignment> inbox(String username, String period) {
    var evaluator = user(username);
    return assignments.findByEvaluator_IdAndCycle_PeriodCodeOrderByDueAtAsc(evaluator.getId(), period);
  }

  @Transactional(readOnly=true)
  public List<PerformanceAssignment> inboxForAdmin(String period) {
    return assignments.findByCycle_PeriodCodeOrderByDueAtAsc(period);
  }

  @Transactional
  public PerformanceAssignment create(String actorUsername, String period, Long templateId, Long subjectId,
      Long evaluatorId, String mode, Instant dueAt) {
    var actor=user(actorUsername);
    var subject=users.findById(subjectId).orElseThrow(() -> error(HttpStatus.NOT_FOUND,"PERFORMANCE_SUBJECT_NOT_FOUND","被评价人不存在"));
    var evaluator=users.findById(evaluatorId).orElseThrow(() -> error(HttpStatus.NOT_FOUND,"PERFORMANCE_EVALUATOR_NOT_FOUND","评价人不存在"));
    var cycle=cycles.findByPeriodCodeAndStatus(period,"OPEN").orElseThrow(() -> error(HttpStatus.NOT_FOUND,"PERFORMANCE_CYCLE_NOT_FOUND","绩效周期不存在或未开放"));
    var template=templates.findById(templateId).orElseThrow(() -> error(HttpStatus.NOT_FOUND,"PERFORMANCE_TEMPLATE_NOT_FOUND","模板不存在"));
    if(!"ACTIVE".equalsIgnoreCase(template.getStatus()) && !"PUBLISHED".equalsIgnoreCase(template.getStatus())) throw error(HttpStatus.CONFLICT,"PERFORMANCE_TEMPLATE_NOT_PUBLISHED","模板尚未发布");
    var sd=department(subject.getId()); var ed=department(evaluator.getId());
    var normalized=mode==null||mode.isBlank()?"subject":mode.trim().toLowerCase(Locale.ROOT);
    if(!Set.of("subject","evaluator").contains(normalized)) throw error(HttpStatus.BAD_REQUEST,"PERFORMANCE_MODE_INVALID","评价模式只能是 subject 或 evaluator");
    if(!template.getDepartment().getId().equals(sd.getId())) throw error(HttpStatus.BAD_REQUEST,"PERFORMANCE_TEMPLATE_SUBJECT_DEPARTMENT_MISMATCH","模板部门与被评价人主部门不一致");
    if(dueAt!=null && cycle.getDueAt()!=null && dueAt.isAfter(cycle.getDueAt())) throw error(HttpStatus.BAD_REQUEST,"PERFORMANCE_ASSIGNMENT_DUE_INVALID","任务截止时间不能晚于周期截止时间");
    var existing=assignments.findByCycle_IdAndTemplate_IdAndSubject_IdAndEvaluator_IdAndEvaluationMode(cycle.getId(),templateId,subjectId,evaluatorId,normalized);
    if(existing.isPresent()) return existing.get();
    var assignment=new PerformanceAssignment(cycle,template,subject,sd,evaluator,ed,normalized);
    assignment.setDueAt(dueAt==null?cycle.getDueAt():dueAt);
    return assignments.save(assignment);
  }

  @Transactional(readOnly=true)
  public PerformanceAssignment getForEvaluator(String username, Long id) {
    var a=assignments.findById(id).orElseThrow(() -> error(HttpStatus.NOT_FOUND,"PERFORMANCE_ASSIGNMENT_NOT_FOUND","评价任务不存在"));
    if(!a.getEvaluator().getUsername().equals(username)) throw error(HttpStatus.FORBIDDEN,"PERFORMANCE_ASSIGNMENT_FORBIDDEN","无权访问此评价任务");
    return a;
  }

  @Transactional
  public void markEvaluation(PerformanceAssignment assignment, PerformanceEvaluation evaluation) {
    assignment.setEvaluation(evaluation); assignment.setStatus("IN_PROGRESS"); assignments.save(assignment);
  }

  private User user(String username){return users.findByUsernameAndStatus(username,"ACTIVE").orElseThrow(() -> error(HttpStatus.UNAUTHORIZED,"USER_NOT_ACTIVE","用户不存在或已停用"));}
  private PerformanceDepartment department(Long userId){return memberships.findPrimary(userId).map(UserDepartmentMembership::getDepartment).orElseThrow(() -> error(HttpStatus.FORBIDDEN,"USER_DEPARTMENT_REQUIRED","用户未配置主部门"));}
  private ResponseStatusException error(HttpStatus status,String code,String message){return new ResponseStatusException(status,code+": "+message);}
}
