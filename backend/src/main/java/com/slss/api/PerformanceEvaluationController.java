package com.slss.api;

import com.slss.domain.PerformanceEvaluation;
import com.slss.service.PerformanceEvaluationService;
import com.slss.service.PerformanceTemplateService;
import com.slss.service.PerformanceExcelImportService;
import com.slss.service.PerformanceTemplateService.SectionInput;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import java.math.BigDecimal;
import java.security.Principal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.*;

@RestController
@RequestMapping("/api/v1/performance")
public class PerformanceEvaluationController {
  private final PerformanceEvaluationService service;
  private final com.slss.service.PerformanceTemplateService templates;
  private final com.slss.service.PerformanceExcelImportService excel;
  private final com.slss.repository.PerformanceDepartmentRepository departments;
  private final com.slss.repository.PerformanceTemplateRepository templateRepository;
  private final com.slss.repository.PerformanceEvaluationRepository evaluationRepository;
  private final com.slss.service.PerformanceAssignmentService assignments;
  private final com.slss.repository.UserRepository users;
  private final com.slss.repository.PerformanceGradeRuleRepository gradeRules;
  public PerformanceEvaluationController(PerformanceEvaluationService s,com.slss.service.PerformanceTemplateService t,com.slss.service.PerformanceExcelImportService e,com.slss.repository.PerformanceDepartmentRepository d,com.slss.repository.PerformanceTemplateRepository tr,com.slss.repository.PerformanceEvaluationRepository er,com.slss.service.PerformanceAssignmentService a,com.slss.repository.UserRepository u,com.slss.repository.PerformanceGradeRuleRepository gr){service=s;templates=t;excel=e;departments=d;templateRepository=tr;evaluationRepository=er;assignments=a;users=u;gradeRules=gr;}
  public record ScoreRequest(@NotNull Long itemId,@NotNull @DecimalMin("0") BigDecimal score,@Size(max=1000) String comment,String scoreType,@DecimalMin("0") BigDecimal monthlyScore){}
  public record SaveRequest(@NotEmpty List<@Valid ScoreRequest> scores,Long expectedVersion,String mode){}
  public record SubmitRequest(Long expectedVersion,String mode){}
  public record NotesRequest(@Size(max=2000) String selfComment,@Size(max=2000) String goodDeeds,@Size(max=2000) String remarks,Long expectedVersion){}
  public record CycleRequest(@NotBlank String periodCode, Instant startsAt, Instant endsAt, Instant publishedAt, Instant dueAt){}
  public record DepartmentAssignment(@NotBlank String departmentId, boolean primary){}
  public record AssignmentRequest(@NotBlank String periodCode,@NotNull Long templateId,@NotNull Long subjectUserId,@NotNull Long evaluatorUserId,String mode,Instant dueAt){}
  public record SubjectBinding(@NotNull Long userId){}

  @PutMapping("/templates/{id}/subject")
  @PreAuthorize("hasAnyAuthority('PERM_MANAGE_PERFORMANCE','PERM_MANAGE_SYSTEM')")
  @Transactional
  public Map<String,Object> bindTemplateSubject(@PathVariable Long id,@Valid @RequestBody SubjectBinding request){
    var template=templateRepository.findById(id).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"模板不存在"));
    var user=users.findById(request.userId()).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"用户不存在"));
    template.setSubjectUser(user); templateRepository.save(template);
    return Map.of("id",id,"subjectUserId",user.getId(),"subjectUsername",user.getUsername());
  }

  @GetMapping("/assignments/inbox")
  @PreAuthorize("isAuthenticated()")
  @Transactional(readOnly=true)
  public List<Map<String,Object>> assignmentInbox(@RequestParam String period, Principal principal){
    return assignments.inbox(principal.getName(),period).stream().map(this::assignmentDto).toList();
  }

  @PostMapping("/assignments")
  @PreAuthorize("hasAnyAuthority('PERM_MANAGE_PERFORMANCE','PERM_MANAGE_SYSTEM')")
  public Map<String,Object> createAssignment(@Valid @RequestBody AssignmentRequest request, Principal principal){
    return assignmentDto(assignments.create(principal.getName(),request.periodCode(),request.templateId(),request.subjectUserId(),request.evaluatorUserId(),request.mode(),request.dueAt()));
  }

  /** Admin task inbox. Kept separate from the evaluator inbox so a user cannot
   * infer or modify tasks outside their own assignment scope. */
  @GetMapping("/admin/assignments")
  @PreAuthorize("hasAnyAuthority('PERM_MANAGE_PERFORMANCE','PERM_MANAGE_SYSTEM')")
  @Transactional(readOnly=true)
  public List<Map<String,Object>> adminAssignments(@RequestParam String period){
    return assignments.inboxForAdmin(period).stream().map(this::assignmentDto).toList();
  }

  @PostMapping("/admin/assignments")
  @PreAuthorize("hasAnyAuthority('PERM_MANAGE_PERFORMANCE','PERM_MANAGE_SYSTEM')")
  public Map<String,Object> createAdminAssignment(@Valid @RequestBody AssignmentRequest request, Principal principal){
    return assignmentDto(assignments.create(principal.getName(),request.periodCode(),request.templateId(),request.subjectUserId(),request.evaluatorUserId(),request.mode(),request.dueAt()));
  }

  @GetMapping("/assignments/{id}")
  @PreAuthorize("isAuthenticated()")
  public Map<String,Object> assignment(@PathVariable Long id, Principal principal){return assignmentDto(assignments.getForEvaluator(principal.getName(),id));}

  @PostMapping("/assignments/{id}/open")
  @PreAuthorize("isAuthenticated()")
  public Map<String,Object> openAssignment(@PathVariable Long id, Principal principal){
    var task=assignments.getForEvaluator(principal.getName(),id);
    var evaluation=service.openAssigned(principal.getName(),task);
    assignments.markEvaluation(task,evaluation);
    return dto(evaluation);
  }

  @GetMapping("/departments")
  @PreAuthorize("hasAnyAuthority('PERM_MANAGE_PERFORMANCE','PERM_MANAGE_SYSTEM')")
  public List<Map<String,Object>> departments(){return departments.findAll().stream().filter(d -> "ACTIVE".equalsIgnoreCase(d.getStatus())).map(d -> Map.<String,Object>of("id",d.getId(),"code",d.getCode(),"name",d.getName())).toList();}

  @GetMapping("/templates")
  @PreAuthorize("hasAnyAuthority('PERM_MANAGE_PERFORMANCE','PERM_MANAGE_SYSTEM')")
  @Transactional(readOnly=true)
  public List<Map<String,Object>> templates(){return templateRepository.findAllForAdmin().stream().<Map<String,Object>>map(t -> {var m=new LinkedHashMap<String,Object>();m.put("id",t.getId());m.put("name",t.getName());m.put("sourceSheet",t.getSourceSheet());m.put("departmentId",t.getDepartment().getCode());m.put("departmentName",t.getDepartment().getName());m.put("subjectUserId",t.getSubjectUser()==null?null:t.getSubjectUser().getId());m.put("subjectUsername",t.getSubjectUser()==null?null:t.getSubjectUser().getUsername());m.put("version",t.getTemplateVersion());m.put("status",t.getStatus());m.put("publishedAt",Objects.toString(t.getPublishedAt(),""));m.put("effectiveFrom",Objects.toString(t.getEffectiveFrom(),""));m.put("effectiveTo",Objects.toString(t.getEffectiveTo(),""));m.put("sections",t.getSections().size());return m;}).toList();}

  public record TemplateMetadataRequest(String name,String status, LocalDate effectiveFrom, LocalDate effectiveTo){}
  @PutMapping("/templates/{id}")
  @PreAuthorize("hasAnyAuthority('PERM_MANAGE_PERFORMANCE','PERM_MANAGE_SYSTEM')")
  public Map<String,Object> updateTemplate(@PathVariable Long id,@RequestBody TemplateMetadataRequest request){var t=templates.updateMetadata(id,request.name(),request.status(),request.effectiveFrom(),request.effectiveTo());return Map.of("id",t.getId(),"name",t.getName(),"status",t.getStatus(),"departmentId",t.getDepartment().getCode(),"version",t.getTemplateVersion(),"effectiveFrom",Objects.toString(t.getEffectiveFrom(),""),"effectiveTo",Objects.toString(t.getEffectiveTo(),""));}

  @GetMapping("/templates/{id}")
  @PreAuthorize("hasAnyAuthority('PERM_MANAGE_PERFORMANCE','PERM_MANAGE_SYSTEM')")
  @Transactional(readOnly=true)
  public Map<String,Object> templateDetail(@PathVariable Long id){var t=templateRepository.findById(id).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"模板不存在")); var sections=t.getSections().stream().map(s->Map.<String,Object>of("sectionCode",s.getCode(),"sectionName",s.getName(),"sectionWeight",s.getWeight(),"items",s.getItems().stream().map(i->Map.<String,Object>of("itemCode",i.getCode(),"keyFactor",i.getKeyFactor(),"standard",i.getStandard(),"maxScore",i.getMaxScore(),"scoreRequired",i.isScoreRequired(),"scopes",i.getScopes().stream().map(x->Map.of("type",x.getType(),"value",Objects.toString(x.getValue(),""))).toList())).toList())).toList(); var fields=t.getFields().stream().map(f->Map.of("code",f.getCode(),"label",f.getLabel(),"type",f.getType(),"required",f.isRequired(),"sortOrder",f.getSortOrder())).toList(); var result=new LinkedHashMap<String,Object>(); result.put("id",t.getId()); result.put("name",t.getName()); result.put("sourceSheet",t.getSourceSheet()); result.put("departmentId",t.getDepartment().getCode()); result.put("departmentName",t.getDepartment().getName()); result.put("subjectUserId",t.getSubjectUser()==null?"":t.getSubjectUser().getId()); result.put("subjectUsername",t.getSubjectUser()==null?"":t.getSubjectUser().getUsername()); result.put("version",t.getTemplateVersion()); result.put("status",t.getStatus()); result.put("publishedAt",Objects.toString(t.getPublishedAt(),"")); result.put("effectiveFrom",Objects.toString(t.getEffectiveFrom(),"")); result.put("effectiveTo",Objects.toString(t.getEffectiveTo(),"")); result.put("fields",fields); result.put("sections",sections); return result;}

  @PutMapping("/templates/{id}/definition")
  @PreAuthorize("hasAnyAuthority('PERM_MANAGE_PERFORMANCE','PERM_MANAGE_SYSTEM')")
  public Map<String,Object> reviseTemplate(@PathVariable Long id,@Valid @RequestBody TemplateRequest request){var next=templates.reviseTemplate(id,new PerformanceTemplateService.TemplateInput(request.departmentId(),request.templateName(),request.sourceSheet(),null,request.sections()));return Map.of("id",next.getId(),"name",next.getName(),"status",next.getStatus(),"version",next.getTemplateVersion());}

  @PostMapping("/templates/{id}/publish")
  @PreAuthorize("hasAnyAuthority('PERM_MANAGE_PERFORMANCE','PERM_MANAGE_SYSTEM')")
  public Map<String,Object> publishTemplate(@PathVariable Long id){var t=templates.publishTemplate(id);return Map.of("id",t.getId(),"name",t.getName(),"status",t.getStatus(),"version",t.getTemplateVersion(),"publishedAt",Objects.toString(t.getPublishedAt(),""));}

  @PostMapping("/templates/{id}/rollback")
  @PreAuthorize("hasAnyAuthority('PERM_MANAGE_PERFORMANCE','PERM_MANAGE_SYSTEM')")
  public Map<String,Object> rollbackTemplate(@PathVariable Long id,@RequestParam Long toId){var t=templates.rollbackTemplate(id,toId);return Map.of("id",t.getId(),"name",t.getName(),"status",t.getStatus(),"version",t.getTemplateVersion());}

  @GetMapping("/templates/{id}/diff")
  @PreAuthorize("hasAnyAuthority('PERM_MANAGE_PERFORMANCE','PERM_MANAGE_SYSTEM')")
  @Transactional(readOnly=true)
  public Map<String,Object> templateDiff(@PathVariable Long id, @RequestParam Long againstId) {
    var left=templateRepository.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,"模板不存在"));
    var right=templateRepository.findById(againstId).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,"对比模板不存在"));
    var leftCodes=left.getSections().stream().flatMap(s->s.getItems().stream()).map(i->i.getCode()).collect(java.util.stream.Collectors.toSet());
    var rightCodes=right.getSections().stream().flatMap(s->s.getItems().stream()).map(i->i.getCode()).collect(java.util.stream.Collectors.toSet());
    var added=new java.util.ArrayList<>(leftCodes); added.removeAll(rightCodes);
    var removed=new java.util.ArrayList<>(rightCodes); removed.removeAll(leftCodes);
    return Map.of("templateId",id,"againstId",againstId,"fromVersion",right.getTemplateVersion(),"toVersion",left.getTemplateVersion(),"addedItemCodes",added,"removedItemCodes",removed,"sectionCountDelta",left.getSections().size()-right.getSections().size());
  }

  @GetMapping("/admin/results")
  @PreAuthorize("hasAnyAuthority('PERM_MANAGE_PERFORMANCE','PERM_MANAGE_SYSTEM')")
  @Transactional(readOnly=true)
  public List<Map<String,Object>> results(@RequestParam String period){return evaluationRepository.findByCycle_PeriodCodeOrderBySubjectDepartment_NameAscSubject_UsernameAsc(period).stream().map(e -> {var m=new LinkedHashMap<String,Object>();m.put("id",e.getId());m.put("periodCode",e.getCycle().getPeriodCode());m.put("templateId",e.getTemplate().getId());m.put("templateVersion",e.getTemplate().getTemplateVersion());m.put("departmentId",e.getSubjectDepartment().getCode());m.put("departmentName",e.getSubjectDepartment().getName());m.put("username",e.getSubject().getUsername());m.put("templateName",e.getTemplate().getName());m.put("evaluationMode",e.getEvaluationMode());m.put("status",e.getStatus());m.put("rawScore",Objects.toString(e.getRawScore(),"0"));m.put("normalizedScore",Objects.toString(e.getNormalizedScore(),"0"));m.put("gradeCode",Objects.toString(e.getGradeCode(),""));m.put("rewardAdjustment",Objects.toString(e.getRewardAdjustment(),""));return (Map<String,Object>)m;}).toList();}

  @GetMapping("/admin/results/page")
  @PreAuthorize("hasAnyAuthority('PERM_MANAGE_PERFORMANCE','PERM_MANAGE_SYSTEM')")
  @Transactional(readOnly=true)
  public Map<String,Object> resultPage(@RequestParam String period,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size){
    var all=evaluationRepository.findByCycle_PeriodCodeOrderBySubjectDepartment_NameAscSubject_UsernameAsc(period);
    var safeSize=Math.max(1,Math.min(200,size)); var safePage=Math.max(0,page); var from=Math.min(all.size(),safePage*safeSize); var to=Math.min(all.size(),from+safeSize);
    var content=all.subList(from,to).stream().map(this::resultDto).toList();
    return Map.of("content",content,"page",safePage,"size",safeSize,"totalElements",all.size(),"totalPages",(all.size()+safeSize-1)/safeSize);
  }

  @GetMapping("/admin/results/summary")
  @PreAuthorize("hasAnyAuthority('PERM_MANAGE_PERFORMANCE','PERM_MANAGE_SYSTEM')")
  @Transactional(readOnly=true)
  public Map<String,Object> resultSummary(@RequestParam String period){
    var all=evaluationRepository.findByCycle_PeriodCodeOrderBySubjectDepartment_NameAscSubject_UsernameAsc(period);
    var byStatus=all.stream().collect(java.util.stream.Collectors.groupingBy(PerformanceEvaluation::getStatus,LinkedHashMap::new,java.util.stream.Collectors.counting()));
    var byDepartment=all.stream().collect(java.util.stream.Collectors.groupingBy(e->e.getSubjectDepartment().getCode(),LinkedHashMap::new,java.util.stream.Collectors.counting()));
    var submitted=all.stream().filter(e->"SUBMITTED".equalsIgnoreCase(e.getStatus())).count();
    return Map.of("period",period,"total",all.size(),"submitted",submitted,"byStatus",byStatus,"byDepartment",byDepartment);
  }

  @GetMapping("/standards")
  @PreAuthorize("hasAnyAuthority('PERM_MANAGE_PERFORMANCE','PERM_MANAGE_SYSTEM')")
  @Transactional(readOnly=true)
  public List<Map<String,Object>> standards(){return gradeRules.findByActiveTrueOrderByMinScoreDesc().stream().map(this::gradeDto).toList();}

  @PutMapping("/standards")
  @PreAuthorize("hasAnyAuthority('PERM_MANAGE_PERFORMANCE','PERM_MANAGE_SYSTEM')")
  @Transactional
  public List<Map<String,Object>> updateStandards(@RequestBody List<Map<String,Object>> input){
    if(input==null||input.isEmpty()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"至少需要一条评定标准");
    var current=new HashMap<String,com.slss.domain.PerformanceGradeRule>(); gradeRules.findAll().forEach(x->current.put(x.getGradeCode(),x));
    for(var row:input){var code=Objects.toString(row.get("grade"),Objects.toString(row.get("gradeCode"),"")).trim().toUpperCase(Locale.ROOT);if(code.isBlank()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"等级不能为空");var rule=current.get(code);if(rule==null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"未知等级: "+code);rule.setGradeLabel(Objects.toString(row.get("label"),rule.getGradeLabel()));rule.setMinScore(decimal(row.get("minScore"),rule.getMinScore()));rule.setMaxScore(decimal(row.get("maxScore"),rule.getMaxScore()));rule.setRewardAdjustment(decimal(row.get("reward"),decimal(row.get("rewardAdjustment"),rule.getRewardAdjustment())));rule.setActive(true);}
    return gradeRules.findByActiveTrueOrderByMinScoreDesc().stream().map(this::gradeDto).toList();
  }

  private BigDecimal decimal(Object value,BigDecimal fallback){if(value==null||Objects.toString(value).isBlank())return fallback;try{return new BigDecimal(Objects.toString(value));}catch(NumberFormatException e){throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"评定标准分值无效");}}
  private Map<String,Object> gradeDto(com.slss.domain.PerformanceGradeRule r){var m=new LinkedHashMap<String,Object>();m.put("id",r.getId());m.put("grade",r.getGradeCode());m.put("label",r.getGradeLabel());m.put("minScore",r.getMinScore());m.put("maxScore",r.getMaxScore());m.put("reward",r.getRewardAdjustment());m.put("version",r.getVersion());return m;}
  private Map<String,Object> resultDto(PerformanceEvaluation e){var m=new LinkedHashMap<String,Object>();m.put("id",e.getId());m.put("periodCode",e.getCycle().getPeriodCode());m.put("templateId",e.getTemplate().getId());m.put("templateVersion",e.getTemplate().getTemplateVersion());m.put("departmentId",e.getSubjectDepartment().getCode());m.put("departmentName",e.getSubjectDepartment().getName());m.put("username",e.getSubject().getUsername());m.put("templateName",e.getTemplate().getName());m.put("evaluationMode",e.getEvaluationMode());m.put("status",e.getStatus());m.put("rawScore",Objects.toString(e.getRawScore(),"0"));m.put("normalizedScore",Objects.toString(e.getNormalizedScore(),"0"));m.put("gradeCode",Objects.toString(e.getGradeCode(),""));m.put("rewardAdjustment",Objects.toString(e.getRewardAdjustment(),""));return m;}
  public record TemplateRequest(@NotBlank String departmentId,@NotBlank String templateName,@NotBlank String sourceSheet,Integer templateVersion,@NotEmpty List<PerformanceTemplateService.SectionInput> sections){}

  @GetMapping("/current")
  @PreAuthorize("isAuthenticated()")
  public Map<String,Object> current(@RequestParam String period,@RequestParam(defaultValue="subject") String mode,Principal principal){return service.current(principal.getName(),period,mode);}

  @PostMapping("/cycles")
  @PreAuthorize("hasAnyAuthority('PERM_MANAGE_PERFORMANCE','PERM_MANAGE_SYSTEM')")
  public Map<String,Object> cycle(@Valid @RequestBody CycleRequest request){var c=service.openCycle(request.periodCode(),request.startsAt(),request.endsAt(),request.publishedAt(),request.dueAt());return Map.of("id",c.getId(),"periodCode",c.getPeriodCode(),"status",c.getStatus(),"version",c.getVersion(),"startsAt",Objects.toString(c.getStartsAt(),""),"endsAt",Objects.toString(c.getEndsAt(),""),"publishedAt",Objects.toString(c.getPublishedAt(),""),"dueAt",Objects.toString(c.getDueAt(),""));}

  @PutMapping("/users/{userId}/department")
  @PreAuthorize("hasAnyAuthority('PERM_MANAGE_PERFORMANCE','PERM_MANAGE_SYSTEM')")
  public Map<String,Object> assignDepartment(@PathVariable Long userId,@Valid @RequestBody DepartmentAssignment request){var m=service.assignDepartment(userId,request.departmentId(),request.primary());return Map.of("userId",userId,"departmentId",m.getDepartment().getCode(),"departmentName",m.getDepartment().getName(),"primary",m.isPrimaryMembership());}

  @PostMapping("/templates/import")
  @PreAuthorize("hasAnyAuthority('PERM_MANAGE_PERFORMANCE','PERM_MANAGE_SYSTEM')")
  public Map<String,Object> importTemplate(@Valid @RequestBody TemplateRequest request){var input=new PerformanceTemplateService.TemplateInput(request.departmentId(),request.templateName(),request.sourceSheet(),request.templateVersion(),request.sections());var t=templates.importTemplate(input);return Map.of("id",t.getId(),"departmentId",t.getDepartment().getCode(),"templateName",t.getName(),"templateVersion",t.getTemplateVersion(),"status",t.getStatus());}

  @PostMapping(value="/templates/import-excel", consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
  @PreAuthorize("hasAnyAuthority('PERM_MANAGE_PERFORMANCE','PERM_MANAGE_SYSTEM')")
  public PerformanceExcelImportService.ImportReport importExcel(@RequestPart("file") org.springframework.web.multipart.MultipartFile file,@RequestParam(defaultValue="skip") String onDuplicate){return excel.importWorkbook(file,"skip".equalsIgnoreCase(onDuplicate));}

  @PostMapping(value="/templates/import-excel/preview", consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
  @PreAuthorize("hasAnyAuthority('PERM_MANAGE_PERFORMANCE','PERM_MANAGE_SYSTEM')")
  public PerformanceExcelImportService.PreviewReport previewExcel(@RequestPart("file") org.springframework.web.multipart.MultipartFile file){return excel.previewWorkbook(file);}

  @PostMapping("/templates/import-excel/confirm")
  @PreAuthorize("hasAnyAuthority('PERM_MANAGE_PERFORMANCE','PERM_MANAGE_SYSTEM')")
  public PerformanceExcelImportService.ImportReport confirmExcel(@RequestParam String token,
      @RequestParam(defaultValue="skip") String onDuplicate){
    return excel.confirmPreview(token,"skip".equalsIgnoreCase(onDuplicate));
  }

  @PostMapping("/evaluations")
  @PreAuthorize("isAuthenticated()")
  public Map<String,Object> open(@RequestParam String period,@RequestParam(defaultValue="subject") String mode,Principal principal){return dto(service.open(principal.getName(),period,mode));}

  @PutMapping("/evaluations/{id}/scores")
  @PreAuthorize("isAuthenticated()")
  public Map<String,Object> scores(@PathVariable Long id,@Valid @RequestBody SaveRequest request,Principal principal){var commands=request.scores().stream().map(x->new PerformanceEvaluationService.ScoreCommand(x.itemId(),x.score(),x.comment(),x.scoreType(),x.monthlyScore())).toList();return dto(service.saveScores(principal.getName(),id,commands,request.mode()==null?"subject":request.mode(),request.expectedVersion()));}

  @PostMapping("/evaluations/{id}/submit")
  @PreAuthorize("isAuthenticated()")
  public Map<String,Object> submit(@PathVariable Long id,@RequestBody(required=false) SubmitRequest request,Principal principal){var r=request==null?new SubmitRequest(null,"subject"):request;return dto(service.submit(principal.getName(),id,r.mode()==null?"subject":r.mode(),r.expectedVersion()));}

  @PutMapping("/evaluations/{id}/notes")
  @PreAuthorize("isAuthenticated()")
  public Map<String,Object> notes(@PathVariable Long id,@Valid @RequestBody NotesRequest request,Principal principal){return dto(service.updateNotes(principal.getName(),id,request.selfComment(),request.goodDeeds(),request.remarks(),request.expectedVersion()));}

  private Map<String,Object> dto(PerformanceEvaluation e){var m=new LinkedHashMap<String,Object>();m.put("id",e.getId());m.put("status",e.getStatus());m.put("rawScore",e.getRawScore());m.put("normalizedScore",e.getNormalizedScore());m.put("gradeCode",e.getGradeCode());m.put("rewardAdjustment",e.getRewardAdjustment());m.put("visibleWeight",e.getVisibleWeight());m.put("version",e.getVersion());m.put("periodCode",e.getCycle().getPeriodCode());m.put("templateVersion",e.getTemplate().getTemplateVersion());m.put("evaluationMode",e.getEvaluationMode());m.put("selfComment",e.getSelfComment());m.put("goodDeeds",e.getGoodDeeds());m.put("remarks",e.getRemarks());m.put("scores",e.getScores().stream().collect(java.util.stream.Collectors.toMap(s->String.valueOf(s.getItem().getId()),s->Map.of("itemId",s.getItem().getId(),"score",s.getScore(),"monthlyScore",Objects.toString(s.getMonthlyScore(),""),"scoreType",s.getScoreType(),"comment",Objects.toString(s.getComment(),"")),(a,b)->b,LinkedHashMap::new)));return m;}
  private Map<String,Object> assignmentDto(com.slss.domain.PerformanceAssignment a){var m=new LinkedHashMap<String,Object>();m.put("id",a.getId());m.put("periodCode",a.getCycle().getPeriodCode());m.put("templateId",a.getTemplate().getId());m.put("templateName",a.getTemplate().getName());m.put("templateVersion",a.getTemplate().getTemplateVersion());m.put("subjectUserId",a.getSubject().getId());m.put("subjectUsername",a.getSubject().getUsername());m.put("evaluatorUserId",a.getEvaluator().getId());m.put("evaluatorUsername",a.getEvaluator().getUsername());m.put("subjectDepartmentId",a.getSubjectDepartment().getCode());m.put("evaluatorDepartmentId",a.getEvaluatorDepartment()==null?null:a.getEvaluatorDepartment().getCode());m.put("mode",a.getEvaluationMode());m.put("status",a.getStatus());m.put("dueAt",Objects.toString(a.getDueAt(),""));m.put("version",a.getVersion());m.put("evaluationId",a.getEvaluation()==null?null:a.getEvaluation().getId());return m;}
}
