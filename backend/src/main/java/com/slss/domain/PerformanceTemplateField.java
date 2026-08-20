package com.slss.domain;

import jakarta.persistence.*;

@Entity
@Table(name="performance_template_fields", uniqueConstraints=@UniqueConstraint(name="uk_performance_template_field", columnNames={"template_id","field_code"}))
public class PerformanceTemplateField {
  @Id @GeneratedValue(strategy=GenerationType.IDENTITY) Long id;
  @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="template_id",nullable=false) PerformanceTemplate template;
  @Column(name="field_code",nullable=false) String code;
  @Column(name="field_label",nullable=false) String label;
  @Column(name="field_type",nullable=false) String type="TEXT";
  @Column(name="required_flag",nullable=false) boolean required;
  @Column(name="sort_order",nullable=false) int sortOrder;
  protected PerformanceTemplateField() {}
  public PerformanceTemplateField(PerformanceTemplate template,String code,String label,String type,boolean required,int sortOrder){this.template=template;this.code=code;this.label=label;this.type=type;this.required=required;this.sortOrder=sortOrder;}
  public Long getId(){return id;} public String getCode(){return code;} public String getLabel(){return label;} public String getType(){return type;} public boolean isRequired(){return required;} public int getSortOrder(){return sortOrder;}
}
