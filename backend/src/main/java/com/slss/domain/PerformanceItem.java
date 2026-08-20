package com.slss.domain;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.util.*;

@Entity @Table(name="performance_items")
public class PerformanceItem {
  @Id @GeneratedValue(strategy=GenerationType.IDENTITY) Long id;
  @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="section_id",nullable=false) PerformanceSection section;
  @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="department_id",nullable=false) PerformanceDepartment department;
  @Column(name="item_code",nullable=false) String code;
  @Column(name="key_factor",nullable=false) String keyFactor;
  @Column(name="standard_text",nullable=false,columnDefinition="TEXT") String standard;
  @Column(name="max_score",nullable=false) BigDecimal maxScore;
  @Column(name="sort_order",nullable=false) int sortOrder;
  @Column(nullable=false) String status="ACTIVE";
  @Column(name="score_required",nullable=false) boolean scoreRequired=true;
  @Version @Column(nullable=false) Long version=0L;
  @OneToMany(mappedBy="item",cascade=CascadeType.ALL,orphanRemoval=true) List<PerformanceItemScope> scopes=new ArrayList<>();
  protected PerformanceItem() {}
  public PerformanceItem(PerformanceSection s,PerformanceDepartment d,String c,String k,String standard,BigDecimal max,int order){section=s;department=d;code=c;keyFactor=k;this.standard=standard;maxScore=max;sortOrder=order;}
  public Long getId(){return id;} public PerformanceSection getSection(){return section;} public PerformanceDepartment getDepartment(){return department;} public String getCode(){return code;} public String getKeyFactor(){return keyFactor;} public String getStandard(){return standard;} public BigDecimal getMaxScore(){return maxScore;} public int getSortOrder(){return sortOrder;} public String getStatus(){return status;} public boolean isScoreRequired(){return scoreRequired;} public void setScoreRequired(boolean value){scoreRequired=value;} public Long getVersion(){return version;} public List<PerformanceItemScope> getScopes(){return scopes;}
}
