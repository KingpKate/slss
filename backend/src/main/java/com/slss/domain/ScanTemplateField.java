package com.slss.domain;
import jakarta.persistence.*;
import com.fasterxml.jackson.annotation.JsonIgnore;
@Entity @Table(name="scan_template_fields")
public class ScanTemplateField {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
 @JsonIgnore @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="template_id",nullable=false) private ScanTemplate template;
 @Column(name="field_key",nullable=false) private String fieldKey;
 @Column(name="field_label",nullable=false) private String fieldLabel;
 @Column(name="field_type",nullable=false) private String fieldType="SN";
 @Column(name="required_flag",nullable=false) private boolean required;
 @Column(name="enabled_flag",nullable=false) private boolean enabled=true;
 @Column(name="scan_required_flag",nullable=false) private boolean scanRequired;
 @Column(name="require_model_flag",nullable=false) private boolean requireModel;
 @Column(name="process_section",nullable=false) private String processSection="组装";
 @Column(name="sort_order",nullable=false) private int sortOrder;
 public Long getId(){return id;} public ScanTemplate getTemplate(){return template;} public void setTemplate(ScanTemplate v){template=v;} public String getFieldKey(){return fieldKey;} public void setFieldKey(String v){fieldKey=v;} public String getFieldLabel(){return fieldLabel;} public void setFieldLabel(String v){fieldLabel=v;} public String getFieldType(){return fieldType;} public void setFieldType(String v){fieldType=v;} public boolean isRequired(){return required;} public void setRequired(boolean v){required=v;} public boolean isEnabled(){return enabled;} public void setEnabled(boolean v){enabled=v;} public boolean isScanRequired(){return scanRequired;} public void setScanRequired(boolean v){scanRequired=v;} public boolean isRequireModel(){return requireModel;} public void setRequireModel(boolean v){requireModel=v;} public String getProcessSection(){return processSection;} public void setProcessSection(String v){processSection=v;} public int getSortOrder(){return sortOrder;} public void setSortOrder(int v){sortOrder=v;}
}
