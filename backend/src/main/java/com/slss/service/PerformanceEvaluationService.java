package com.slss.service;

import com.slss.domain.*;
import com.slss.repository.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import java.math.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@Service
public class PerformanceEvaluationService {
  public record Context(User user, PerformanceDepartment department) {}
  public record ScoreCommand(Long itemId, BigDecimal score, String comment, String scoreType, BigDecimal monthlyScore) {
    public ScoreCommand(Long itemId, BigDecimal score, String comment){this(itemId,score,comment,null,null);}
  }
  private final UserRepository users; private final UserDepartmentMembershipRepository memberships; private final PerformanceDepartmentRepository departments; private final PerformanceTemplateRepository templates; private final PerformanceCycleRepository cycles; private final PerformanceEvaluationRepository evaluations; private final PerformanceScoreRepository scores; private final PerformanceAssignmentRepository assignments; private final PerformanceGradeRuleRepository gradeRules;
  public PerformanceEvaluationService(UserRepository u,UserDepartmentMembershipRepository m,PerformanceDepartmentRepository d,PerformanceTemplateRepository t,PerformanceCycleRepository c,PerformanceEvaluationRepository e,PerformanceScoreRepository s,PerformanceAssignmentRepository a,PerformanceGradeRuleRepository g){users=u;memberships=m;departments=d;templates=t;cycles=c;evaluations=e;scores=s;assignments=a;gradeRules=g;}

  @Transactional(readOnly=true)
  public Context context(String username){
    var user=users.findByUsernameAndStatus(username,"ACTIVE").orElseThrow(()->error(HttpStatus.UNAUTHORIZED,"USER_NOT_ACTIVE","用户不存在或已停用"));
    var membership=memberships.findPrimary(user.getId()).orElseThrow(()->error(HttpStatus.FORBIDDEN,"USER_DEPARTMENT_REQUIRED","当前用户未配置有效主部门"));
    return new Context(user,membership.getDepartment());
  }

  @Transactional(readOnly=true)
  public Map<String,Object> current(String username,String period,String mode){
    var ctx=context(username); var cycle=availableCycle(period);
    var template=effectiveTemplate(ctx.department().getCode(), period, ctx.user().getId()).orElseThrow(()->error(HttpStatus.NOT_FOUND,"PERFORMANCE_TEMPLATE_NOT_FOUND","当前部门没有启用的绩效模板"));
    var sections=template.getSections().stream().map(section->{
      var items=section.getItems().stream().filter(i->visible(i,ctx,mode)).map(i->itemDto(i)).toList();
      return Map.<String,Object>of("sectionId",section.getCode(),"name",section.getName(),"sectionWeight",section.getWeight(),"items",items);
    }).filter(x->!((List<?>)x.get("items")).isEmpty()).toList();
    var result=new LinkedHashMap<String,Object>(); result.put("cycle",Map.of("id",cycle.getId(),"periodCode",cycle.getPeriodCode(),"status",cycle.getStatus(),"startsAt",Objects.toString(cycle.getStartsAt(),""),"endsAt",Objects.toString(cycle.getEndsAt(),""),"dueAt",Objects.toString(cycle.getDueAt(),""))); result.put("principal",Map.of("userId",ctx.user().getId(),"departmentId",ctx.department().getCode(),"departmentName",ctx.department().getName(),"mode",mode)); result.put("template",Map.of("id",template.getId(),"name",template.getName(),"departmentId",ctx.department().getCode(),"departmentName",ctx.department().getName(),"version",template.getTemplateVersion(),"effectiveFrom",Objects.toString(template.getEffectiveFrom(),""),"effectiveTo",Objects.toString(template.getEffectiveTo(),""),"sections",sections)); return result;
  }

  @Transactional
  public PerformanceCycle openCycle(String period){
    return openCycle(period,null,null,null,null);
  }

  @Transactional
  public PerformanceCycle openCycle(String period, Instant startsAt, Instant endsAt, Instant publishedAt, Instant dueAt){
    if(period==null||!period.matches("\\d{4}-\\d{2}")) throw error(HttpStatus.BAD_REQUEST,"PERFORMANCE_PERIOD_INVALID","周期格式必须为 YYYY-MM");
    var cycle=cycles.findByPeriodCodeAndStatus(period,"OPEN").orElseGet(()->new PerformanceCycle(period));
    if(startsAt!=null) cycle.setStartsAt(startsAt); if(endsAt!=null) cycle.setEndsAt(endsAt); if(publishedAt!=null) cycle.setPublishedAt(publishedAt); if(dueAt!=null) cycle.setDueAt(dueAt);
    return cycles.save(cycle);
  }

  @Transactional
  public UserDepartmentMembership assignDepartment(Long userId, String departmentId, boolean primary) {
    var user=users.findById(userId).orElseThrow(()->error(HttpStatus.NOT_FOUND,"USER_NOT_FOUND","用户不存在"));
    var department=departments.findByCodeAndStatus(departmentId.trim().toUpperCase(Locale.ROOT),"ACTIVE").or(()->departments.findByNameAndStatus(departmentId.trim(),"ACTIVE")).orElseThrow(()->error(HttpStatus.BAD_REQUEST,"PERFORMANCE_DEPARTMENT_INVALID","部门不存在或已停用"));
    if(primary) memberships.findActiveByUser(userId).forEach(m -> { if(!m.getDepartment().getId().equals(department.getId())) m.setPrimaryMembership(false); });
    var membership=memberships.findActiveByUserAndDepartment(userId,department.getId()).orElseGet(()->new UserDepartmentMembership(user,department,primary));
    membership.setPrimaryMembership(primary); membership.setEffectiveTo(null); return memberships.save(membership);
  }

  @Transactional
  public PerformanceEvaluation open(String username,String period,String mode){
    var normalizedMode=normalizeMode(mode); var ctx=context(username); var cycle=availableCycle(period); var template=effectiveTemplate(ctx.department().getCode(), period, ctx.user().getId()).orElseThrow(()->error(HttpStatus.NOT_FOUND,"PERFORMANCE_TEMPLATE_NOT_FOUND","当前部门没有启用的绩效模板"));
    // All evaluations must originate from a server-created assignment.  Keep
    // this legacy endpoint for older clients, but never let request parameters
    // create an unassigned subject/evaluator record.
    var assignment=assignments.findByCycle_IdAndTemplate_IdAndSubject_IdAndEvaluator_IdAndEvaluationMode(
        cycle.getId(),template.getId(),ctx.user().getId(),ctx.user().getId(),normalizedMode)
        .orElseThrow(() -> error(HttpStatus.FORBIDDEN,"PERFORMANCE_ASSIGNMENT_REQUIRED","当前周期没有分配给您的评价任务"));
    return openAssigned(username,assignment);
  }

  /** Opens a task using the server-assigned subject/evaluator pair. */
  @Transactional
  public PerformanceEvaluation openAssigned(String username, PerformanceAssignment assignment) {
    var ctx=context(username);
    if(!Objects.equals(ctx.user().getId(), assignment.getEvaluator().getId())) throw error(HttpStatus.FORBIDDEN,"PERFORMANCE_ASSIGNMENT_FORBIDDEN","无权打开此评价任务");
    var cycle=availableCycle(assignment.getCycle().getPeriodCode());
    if(assignment.getDueAt()!=null && Instant.now().isAfter(assignment.getDueAt())) throw error(HttpStatus.CONFLICT,"PERFORMANCE_ASSIGNMENT_DUE","评价任务已超过截止时间");
    var existing=evaluations.findByCycle_IdAndTemplate_IdAndSubject_IdAndEvaluator_IdAndEvaluationMode(
        cycle.getId(),assignment.getTemplate().getId(),assignment.getSubject().getId(),ctx.user().getId(),assignment.getEvaluationMode());
    if(existing.isPresent()) return existing.get();
    var evaluation=new PerformanceEvaluation(cycle,assignment.getTemplate(),assignment.getSubject(),assignment.getSubjectDepartment());
    evaluation.setEvaluator(ctx.user()); evaluation.setEvaluatorDepartment(ctx.department()); evaluation.setEvaluationMode(assignment.getEvaluationMode());
    return evaluations.save(evaluation);
  }

  @Transactional
  public PerformanceEvaluation saveScores(String username,Long evaluationId,List<ScoreCommand> commands,String mode,Long expectedVersion){
    var normalizedMode=normalizeMode(mode); var ctx=context(username); var evaluation=evaluations.findById(evaluationId).orElseThrow(()->error(HttpStatus.NOT_FOUND,"PERFORMANCE_EVALUATION_NOT_FOUND","绩效评价不存在"));
    ensureWithinDeadline(evaluation);
    if(evaluation.getEvaluator()==null || !evaluation.getEvaluator().getId().equals(ctx.user().getId())) throw error(HttpStatus.FORBIDDEN,"PERFORMANCE_EVALUATOR_FORBIDDEN","当前账号不是该评价任务的评价人");
    if(!normalizedMode.equalsIgnoreCase(evaluation.getEvaluationMode())) throw error(HttpStatus.CONFLICT,"PERFORMANCE_MODE_CONFLICT","评价视角与当前评价记录不一致");
    if(!Set.of("DRAFT","IN_PROGRESS").contains(evaluation.getStatus())) throw error(HttpStatus.CONFLICT,"PERFORMANCE_LOCKED","评价已提交或锁定");
    if(expectedVersion!=null&&!expectedVersion.equals(evaluation.getVersion())) throw error(HttpStatus.CONFLICT,"PERFORMANCE_VERSION_CONFLICT","评价已被其他人修改，请刷新后重试");
    var visible=itemsFor(evaluation.getTemplate(),ctx,mode).collect(Collectors.toMap(PerformanceItem::getId,x->x));
    for(var command:commands==null?List.<ScoreCommand>of():commands){var item=visible.get(command.itemId());if(item==null)throw error(HttpStatus.FORBIDDEN,"PERFORMANCE_ITEM_FORBIDDEN","指标未授权或不属于当前部门"); if(command.score()==null||command.score().compareTo(BigDecimal.ZERO)<0||command.score().compareTo(item.getMaxScore())>0)throw error(HttpStatus.BAD_REQUEST,"PERFORMANCE_SCORE_INVALID","评分超出指标范围"); var existing=scores.findByEvaluation_IdAndItem_IdAndEvaluator_Id(evaluationId,item.getId(),ctx.user().getId()).orElse(null); if(existing==null){existing=new PerformanceScore(evaluation,item,ctx.user(),ctx.department(),command.score(),command.comment()); evaluation.getScores().add(existing);} existing.setScore(command.score()); existing.setComment(command.comment()); existing.setScoreType(normalizeScoreType(command.scoreType(), normalizedMode)); if(command.monthlyScore()!=null && (command.monthlyScore().compareTo(BigDecimal.ZERO)<0 || command.monthlyScore().compareTo(item.getMaxScore())>0)) throw error(HttpStatus.BAD_REQUEST,"PERFORMANCE_MONTHLY_SCORE_INVALID","当月折算分超出指标范围"); existing.setMonthlyScore(command.monthlyScore()); scores.save(existing); }
    evaluation.setStatus("IN_PROGRESS"); recalculate(evaluation,visible.values()); return evaluations.save(evaluation);
  }

  @Transactional
  public PerformanceEvaluation submit(String username,Long id,String mode,Long expectedVersion){
    var normalizedMode=normalizeMode(mode); var ctx=context(username); var e=evaluations.findById(id).orElseThrow(()->error(HttpStatus.NOT_FOUND,"PERFORMANCE_EVALUATION_NOT_FOUND","绩效评价不存在"));
    ensureWithinDeadline(e);
    if(e.getEvaluator()==null || !e.getEvaluator().getId().equals(ctx.user().getId()))throw error(HttpStatus.FORBIDDEN,"PERFORMANCE_EVALUATOR_FORBIDDEN","当前账号不是该评价任务的评价人");
    if(!normalizedMode.equalsIgnoreCase(e.getEvaluationMode())) throw error(HttpStatus.CONFLICT,"PERFORMANCE_MODE_CONFLICT","评价视角与当前评价记录不一致");
    if(!Set.of("DRAFT","IN_PROGRESS").contains(e.getStatus()))throw error(HttpStatus.CONFLICT,"PERFORMANCE_ALREADY_SUBMITTED","本周期评价已经提交，不能重复提交");
    if(expectedVersion!=null&&!expectedVersion.equals(e.getVersion()))throw error(HttpStatus.CONFLICT,"PERFORMANCE_VERSION_CONFLICT","评价已被其他人修改，请刷新后重试");
    var visible=itemsFor(e.getTemplate(),ctx,mode).toList(); if(visible.isEmpty())throw error(HttpStatus.BAD_REQUEST,"NO_VISIBLE_ITEMS","当前用户没有可评价指标");
    var owned=e.getScores().stream().filter(x->x.getEvaluator().getId().equals(ctx.user().getId())).collect(Collectors.toMap(x->x.getItem().getId(),x->x,(a,b)->b));
    var missing=visible.stream().filter(PerformanceItem::isScoreRequired).filter(i->!owned.containsKey(i.getId())).toList();
    if(!missing.isEmpty())throw error(HttpStatus.BAD_REQUEST,"REQUIRED_SCORES_MISSING","尚有必填指标未评分: "+missing.stream().map(PerformanceItem::getCode).collect(Collectors.joining(",")));
    recalculate(e,visible); e.submit(hash(e.getId()+"|"+ctx.user().getId()+"|"+Instant.now()));
    assignments.findByEvaluation_Id(e.getId()).ifPresent(a -> { a.setStatus("SUBMITTED"); assignments.save(a); });
    return evaluations.save(e);
  }

  @Transactional
  public PerformanceEvaluation updateNotes(String username, Long id, String selfComment, String goodDeeds, String remarks, Long expectedVersion) {
    var ctx=context(username); var e=evaluations.findById(id).orElseThrow(()->error(HttpStatus.NOT_FOUND,"PERFORMANCE_EVALUATION_NOT_FOUND","绩效评价不存在"));
    if(e.getEvaluator()==null || !e.getEvaluator().getId().equals(ctx.user().getId())) throw error(HttpStatus.FORBIDDEN,"PERFORMANCE_EVALUATOR_FORBIDDEN","当前账号不是该评价任务的评价人");
    if(!Set.of("DRAFT","IN_PROGRESS").contains(e.getStatus())) throw error(HttpStatus.CONFLICT,"PERFORMANCE_LOCKED","评价已提交或锁定");
    if(expectedVersion!=null&&!expectedVersion.equals(e.getVersion())) throw error(HttpStatus.CONFLICT,"PERFORMANCE_VERSION_CONFLICT","评价已被其他人修改，请刷新后重试");
    e.setSelfComment(selfComment); e.setGoodDeeds(goodDeeds); e.setRemarks(remarks); e.setStatus("IN_PROGRESS"); return evaluations.save(e);
  }

  private void ensureWithinDeadline(PerformanceEvaluation evaluation) {
    Instant now=Instant.now();
    if (evaluation.getCycle().getEndsAt()!=null && now.isAfter(evaluation.getCycle().getEndsAt())) throw error(HttpStatus.CONFLICT,"PERFORMANCE_CYCLE_CLOSED","绩效周期已结束");
    if (evaluation.getCycle().getDueAt()!=null && now.isAfter(evaluation.getCycle().getDueAt())) throw error(HttpStatus.CONFLICT,"PERFORMANCE_CYCLE_DUE","绩效提交截止时间已过");
    assignments.findByEvaluation_Id(evaluation.getId()).ifPresent(a -> { if (a.getDueAt()!=null && now.isAfter(a.getDueAt())) throw error(HttpStatus.CONFLICT,"PERFORMANCE_ASSIGNMENT_DUE","评价任务已超过截止时间"); });
  }

  private void recalculate(PerformanceEvaluation e,Collection<PerformanceItem> visible){
    var bySection=visible.stream().collect(Collectors.groupingBy(PerformanceItem::getSection)); BigDecimal earned=BigDecimal.ZERO,weight=BigDecimal.ZERO,raw=BigDecimal.ZERO;
    for(var entry:bySection.entrySet()){var items=entry.getValue(); BigDecimal max=items.stream().map(PerformanceItem::getMaxScore).reduce(BigDecimal.ZERO,BigDecimal::add); BigDecimal actual=items.stream().map(i->e.getScores().stream().filter(s->s.getItem().getId().equals(i.getId())).map(s->s.getMonthlyScore()==null?s.getScore():s.getMonthlyScore()).findFirst().orElse(BigDecimal.ZERO)).reduce(BigDecimal.ZERO,BigDecimal::add); if(max.signum()>0){var w=entry.getKey().getWeight(); earned=earned.add(actual.divide(max,8,RoundingMode.HALF_UP).multiply(w));weight=weight.add(w);raw=raw.add(actual);}}
    e.setRawScore(raw.setScale(2,RoundingMode.HALF_UP)); e.setVisibleWeight(weight);
    var normalized=weight.signum()==0?BigDecimal.ZERO:earned.divide(weight,8,RoundingMode.HALF_UP).multiply(BigDecimal.valueOf(100)).setScale(2,RoundingMode.HALF_UP);
    e.setNormalizedScore(normalized);
    var rule=gradeRules.findByActiveTrueOrderByMinScoreDesc().stream().filter(x->normalized.compareTo(x.getMinScore())>=0 && (x.getMaxScore()==null || normalized.compareTo(x.getMaxScore())<=0)).findFirst().orElse(null);
    if(rule!=null){e.setGradeCode(rule.getGradeCode());e.setRewardAdjustment(rule.getRewardAdjustment());}
  }
  private boolean visible(PerformanceItem item,Context ctx,String mode){return item.getScopes().isEmpty() || item.getScopes().stream().anyMatch(s->"ALL".equalsIgnoreCase(s.getType())||("DEPARTMENT".equalsIgnoreCase(s.getType())&&ctx.department().getCode().equalsIgnoreCase(s.getValue()))||("USER".equalsIgnoreCase(s.getType())&&String.valueOf(ctx.user().getId()).equals(s.getValue()))||("ROLE".equalsIgnoreCase(s.getType())&&ctx.user().getRoles().stream().anyMatch(r->r.getCode().equalsIgnoreCase(s.getValue()))));}
  private Stream<PerformanceItem> itemsFor(PerformanceTemplate t,Context c,String mode){return t.getSections().stream().flatMap(s->s.getItems().stream()).filter(i->"ACTIVE".equalsIgnoreCase(i.getStatus())).filter(i->visible(i,c,mode));}
  private Optional<PerformanceTemplate> effectiveTemplate(String departmentCode,String period,Long userId){
    LocalDate parsedDate;
    try { parsedDate=LocalDate.of(Integer.parseInt(period.substring(0,4)),Integer.parseInt(period.substring(5,7)),1); } catch(Exception ex) { parsedDate=LocalDate.now(); }
    final LocalDate date=parsedDate;
    return templates.findActiveForDepartment(departmentCode).stream()
      .filter(t -> t.getSubjectUser()==null || Objects.equals(t.getSubjectUser().getId(),userId))
      .filter(t -> (t.getEffectiveFrom()==null || !date.isBefore(t.getEffectiveFrom())) && (t.getEffectiveTo()==null || !date.isAfter(t.getEffectiveTo())))
      .sorted(Comparator.comparing((PerformanceTemplate t) -> t.getSubjectUser()!=null && Objects.equals(t.getSubjectUser().getId(), userId)).reversed()
        .thenComparing(PerformanceTemplate::getTemplateVersion, Comparator.reverseOrder()))
      .findFirst();
  }
  private PerformanceCycle availableCycle(String period){
    var cycle=cycles.findByPeriodCodeAndStatus(period,"OPEN").orElseThrow(()->error(HttpStatus.NOT_FOUND,"PERFORMANCE_CYCLE_NOT_FOUND","绩效周期不存在或未开放"));
    var now=Instant.now();
    if(cycle.getStartsAt()!=null && now.isBefore(cycle.getStartsAt())) throw error(HttpStatus.CONFLICT,"PERFORMANCE_CYCLE_NOT_STARTED","绩效周期尚未开始");
    if(cycle.getEndsAt()!=null && now.isAfter(cycle.getEndsAt())) throw error(HttpStatus.CONFLICT,"PERFORMANCE_CYCLE_CLOSED","绩效周期已结束");
    if(cycle.getDueAt()!=null && now.isAfter(cycle.getDueAt())) throw error(HttpStatus.CONFLICT,"PERFORMANCE_CYCLE_DUE","绩效提交截止时间已过");
    return cycle;
  }
  private String normalizeMode(String mode){return mode==null||mode.isBlank()?"subject":mode.trim().toLowerCase(Locale.ROOT);}
  private String normalizeScoreType(String type,String mode){
    var value=type==null||type.isBlank()?null:type.trim().toUpperCase(Locale.ROOT);
    if(value==null) value="subject".equalsIgnoreCase(mode)?"SELF":"COLLABORATIVE";
    if("SUBJECT".equals(value)) value="SELF";
    if(!Set.of("SELF","MANAGER","COLLABORATIVE","HR").contains(value)) throw error(HttpStatus.BAD_REQUEST,"PERFORMANCE_SCORE_TYPE_INVALID","评分类型无效");
    if("subject".equalsIgnoreCase(mode) && !Set.of("SELF","HR").contains(value)) throw error(HttpStatus.BAD_REQUEST,"PERFORMANCE_SCORE_TYPE_CONFLICT","本部门评价只能保存自评或 HR 评分");
    if("evaluator".equalsIgnoreCase(mode) && !Set.of("MANAGER","COLLABORATIVE","HR").contains(value)) throw error(HttpStatus.BAD_REQUEST,"PERFORMANCE_SCORE_TYPE_CONFLICT","协同评价只能保存主管、协同或 HR 评分");
    return value;
  }
  private Map<String,Object> itemDto(PerformanceItem i){return Map.of("itemId",i.getId(),"itemCode",i.getCode(),"departmentId",i.getDepartment().getCode(),"roleScope",List.of("SUBJECT_DEPARTMENT"),"evaluatorScope",i.getScopes().stream().map(PerformanceItemScope::getValue).filter(Objects::nonNull).toList(),"keyFactor",i.getKeyFactor(),"standard",i.getStandard(),"maxScore",i.getMaxScore(),"scoreRequired",i.isScoreRequired(),"version",i.getVersion());}
  private String hash(String input){try{var d=MessageDigest.getInstance("SHA-256").digest(input.getBytes(StandardCharsets.UTF_8));var b=new StringBuilder();for(byte x:d)b.append(String.format("%02x",x));return b.toString();}catch(Exception e){throw new IllegalStateException(e);}}
  private ResponseStatusException error(HttpStatus s,String code,String message){return new ResponseStatusException(s,code+": "+message);}
}
