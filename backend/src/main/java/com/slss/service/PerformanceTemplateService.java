package com.slss.service;

import com.slss.domain.*;
import com.slss.repository.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import java.math.*;
import java.util.*;

@Service
public class PerformanceTemplateService {
  public record ScopeInput(String type,String value) {}
  public record ItemInput(String itemCode,String keyFactor,String standard,BigDecimal maxScore,List<ScopeInput> scopes) {}
  public record SectionInput(String sectionCode,String sectionName,BigDecimal sectionWeight,List<ItemInput> items) {}
  public record FieldInput(String code,String label,String type,boolean required,int sortOrder) {}
  public record TemplateInput(String departmentId,String templateName,String sourceSheet,Integer templateVersion,List<SectionInput> sections,Long subjectUserId,List<FieldInput> fields) {
    public TemplateInput(String departmentId,String templateName,String sourceSheet,Integer templateVersion,List<SectionInput> sections){this(departmentId,templateName,sourceSheet,templateVersion,sections,null,List.of());}
    public TemplateInput(String departmentId,String templateName,String sourceSheet,Integer templateVersion,List<SectionInput> sections,Long subjectUserId){this(departmentId,templateName,sourceSheet,templateVersion,sections,subjectUserId,List.of());}
  }
  private final PerformanceDepartmentRepository departments; private final PerformanceTemplateRepository templates; private final UserRepository users;
  public PerformanceTemplateService(PerformanceDepartmentRepository d,PerformanceTemplateRepository t,UserRepository u){departments=d;templates=t;users=u;}

  @Transactional
  public PerformanceTemplate importTemplate(TemplateInput input){
    if(input==null||blank(input.departmentId())||blank(input.templateName())||blank(input.sourceSheet())||input.sections()==null||input.sections().isEmpty()) invalid("模板信息不完整");
    var department=departments.findByCodeAndStatus(input.departmentId().trim().toUpperCase(Locale.ROOT),"ACTIVE").or(()->departments.findByNameAndStatus(input.departmentId().trim(),"ACTIVE")).orElseThrow(()->error(HttpStatus.BAD_REQUEST,"PERFORMANCE_DEPARTMENT_INVALID","部门不存在或已停用"));
    int version=input.templateVersion()==null?1:input.templateVersion(); if(version<1)invalid("模板版本必须大于 0"); if(templates.existsByDepartment_IdAndNameAndTemplateVersion(department.getId(),input.templateName().trim(),version))throw error(HttpStatus.CONFLICT,"PERFORMANCE_TEMPLATE_EXISTS","同部门同名称同版本模板已存在");
    User subjectUser=null;
    if(input.subjectUserId()!=null) subjectUser=users.findById(input.subjectUserId()).orElseThrow(() -> error(HttpStatus.BAD_REQUEST,"PERFORMANCE_SUBJECT_USER_NOT_FOUND","模板绑定的员工不存在"));
    var sectionCodes=new HashSet<String>(); var itemCodes=new HashSet<String>(); BigDecimal sectionSum=BigDecimal.ZERO; BigDecimal itemSum=BigDecimal.ZERO; var template=new PerformanceTemplate(department,input.templateName().trim(),input.sourceSheet().trim()); template.setSubjectUser(subjectUser); template.setTemplateVersion(version); template.setStatus("DRAFT"); template.setPublishedAt(null);
    int sectionOrder=0;
    for(var sectionInput:input.sections()){
      if(sectionInput==null||blank(sectionInput.sectionCode())||blank(sectionInput.sectionName())||sectionInput.sectionWeight()==null||sectionInput.sectionWeight().compareTo(BigDecimal.ZERO)<=0||sectionInput.items()==null||sectionInput.items().isEmpty())invalid("指标分区信息不完整");
      if(!sectionCodes.add(sectionInput.sectionCode().trim()))invalid("指标分区编码重复: "+sectionInput.sectionCode()); sectionSum=sectionSum.add(sectionInput.sectionWeight()); var section=new PerformanceSection(template,sectionInput.sectionCode().trim(),sectionInput.sectionName().trim(),sectionInput.sectionWeight(),sectionOrder++); template.getSections().add(section);
      int itemOrder=0;
      for(var itemInput:sectionInput.items()){
        if(itemInput==null||blank(itemInput.itemCode())||blank(itemInput.keyFactor())||blank(itemInput.standard())||itemInput.maxScore()==null||itemInput.maxScore().compareTo(BigDecimal.ZERO)<=0)invalid("指标信息不完整");
        if(!itemCodes.add(itemInput.itemCode().trim()))invalid("指标编码重复: "+itemInput.itemCode()); itemSum=itemSum.add(itemInput.maxScore()); var item=new PerformanceItem(section,department,itemInput.itemCode().trim(),itemInput.keyFactor().trim(),itemInput.standard().trim(),itemInput.maxScore(),itemOrder++); section.getItems().add(item);
        var scopes=itemInput.scopes()==null?List.<ScopeInput>of():itemInput.scopes(); if(scopes.isEmpty())invalid("指标必须配置评价范围: "+itemInput.itemCode()); var scopeKeys=new HashSet<String>(); for(var scope:scopes){if(scope==null||blank(scope.type())||!Set.of("ALL","DEPARTMENT","ROLE","USER","TEAM").contains(scope.type().trim().toUpperCase(Locale.ROOT)))invalid("评价范围类型无效: "+itemInput.itemCode()); var type=scope.type().trim().toUpperCase(Locale.ROOT); var key=type+":"+Objects.toString(scope.value(),""); if(!scopeKeys.add(key))invalid("评价范围重复: "+itemInput.itemCode()); if(!"ALL".equals(type)&&blank(scope.value()))invalid("部门/角色/用户评价范围必须有值: "+itemInput.itemCode()); var entity=new PerformanceItemScope(item,type,blank(scope.value())?null:scope.value().trim()); item.getScopes().add(entity); }
      }
    }
    if(sectionSum.compareTo(BigDecimal.ONE)!=0)invalid("分区权重合计必须为 1，当前为 "+sectionSum); if(itemSum.compareTo(BigDecimal.valueOf(100))!=0)invalid("指标最大分值合计必须为 100，当前为 "+itemSum);
    var fieldInputs=input.fields()==null||input.fields().isEmpty()?List.of(new FieldInput("SELF_COMMENT","员工自评","TEXT",false,0),new FieldInput("GOOD_DEEDS","好人好事","TEXT",false,1),new FieldInput("REMARKS","备注","TEXT",false,2)):input.fields();
    for(var f:fieldInputs){if(f==null||blank(f.code())||blank(f.label())) invalid("附加字段信息不完整");template.getFields().add(new PerformanceTemplateField(template,f.code().trim(),f.label().trim(),blank(f.type())?"TEXT":f.type().trim().toUpperCase(Locale.ROOT),f.required(),f.sortOrder()));}
    return templates.save(template);
  }
  public boolean templateExists(String departmentId, String name, int version) {
    var department=departments.findByCodeAndStatus(departmentId.trim().toUpperCase(Locale.ROOT),"ACTIVE").or(()->departments.findByNameAndStatus(departmentId.trim(),"ACTIVE")).orElse(null);
    return department != null && templates.existsByDepartment_IdAndNameAndTemplateVersion(department.getId(),name.trim(),version);
  }
  @Transactional
  public PerformanceTemplate updateMetadata(Long id, String name, String status) {
    return updateMetadata(id,name,status,null,null);
  }
  @Transactional
  public PerformanceTemplate updateMetadata(Long id, String name, String status, java.time.LocalDate effectiveFrom, java.time.LocalDate effectiveTo) {
    var template=templates.findById(id).orElseThrow(()->error(HttpStatus.NOT_FOUND,"PERFORMANCE_TEMPLATE_NOT_FOUND","模板不存在"));
    if(name!=null&&!name.isBlank()) template.setName(name.trim());
    if(status!=null&&!Set.of("ACTIVE","DRAFT","ARCHIVED").contains(status.toUpperCase(Locale.ROOT))) invalid("模板状态无效");
    if(status!=null) { template.setStatus(status.toUpperCase(Locale.ROOT)); if("ACTIVE".equalsIgnoreCase(status)) template.setPublishedAt(java.time.Instant.now()); else template.setPublishedAt(null); }
    if(effectiveFrom!=null && effectiveTo!=null && effectiveFrom.isAfter(effectiveTo)) invalid("模板生效日期不能晚于结束日期");
    if(effectiveFrom!=null) template.setEffectiveFrom(effectiveFrom); if(effectiveTo!=null) template.setEffectiveTo(effectiveTo);
    return templates.save(template);
  }
  @Transactional
  public PerformanceTemplate reviseTemplate(Long id, TemplateInput input) {
    var current=templates.findById(id).orElseThrow(()->error(HttpStatus.NOT_FOUND,"PERFORMANCE_TEMPLATE_NOT_FOUND","模板不存在"));
    var revision=new TemplateInput(current.getDepartment().getCode(), input.templateName(), input.sourceSheet(), current.getTemplateVersion()+1, input.sections(), current.getSubjectUser()==null?null:current.getSubjectUser().getId(), input.fields());
    var next=importTemplate(revision); next.setStatus("DRAFT"); next.setPublishedAt(null); return templates.save(next);
  }
  @Transactional
  public PerformanceTemplate publishTemplate(Long id) {
    var current=templates.findById(id).orElseThrow(()->error(HttpStatus.NOT_FOUND,"PERFORMANCE_TEMPLATE_NOT_FOUND","模板不存在"));
    templates.findActiveForDepartment(current.getDepartment().getCode()).forEach(t -> { if(!t.getId().equals(id)) { t.setStatus("ARCHIVED"); t.setPublishedAt(null); } });
    current.setStatus("ACTIVE"); current.setPublishedAt(java.time.Instant.now()); return templates.save(current);
  }
  @Transactional
  public PerformanceTemplate rollbackTemplate(Long currentId, Long sourceId) {
    var current=templates.findById(currentId).orElseThrow(()->error(HttpStatus.NOT_FOUND,"PERFORMANCE_TEMPLATE_NOT_FOUND","当前模板不存在"));
    var source=templates.findById(sourceId).orElseThrow(()->error(HttpStatus.NOT_FOUND,"PERFORMANCE_TEMPLATE_SOURCE_NOT_FOUND","回滚来源模板不存在"));
    if(!current.getDepartment().getId().equals(source.getDepartment().getId())) invalid("回滚模板必须属于同一部门");
    var sections=source.getSections().stream().map(s -> new SectionInput(s.getCode(),s.getName(),s.getWeight(),s.getItems().stream().map(i -> new ItemInput(i.getCode(),i.getKeyFactor(),i.getStandard(),i.getMaxScore(),i.getScopes().stream().map(x -> new ScopeInput(x.getType(),x.getValue())).toList())).toList())).toList();
    return reviseTemplate(currentId,new TemplateInput(source.getDepartment().getCode(),source.getName(),source.getSourceSheet(),null,sections,source.getSubjectUser()==null?null:source.getSubjectUser().getId()));
  }
  private boolean blank(String x){return x==null||x.isBlank();} private void invalid(String x){throw error(HttpStatus.BAD_REQUEST,"PERFORMANCE_TEMPLATE_INVALID",x);} private ResponseStatusException error(HttpStatus s,String code,String msg){return new ResponseStatusException(s,code+": "+msg);}
}
