package com.slss.domain;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.util.*;

@Entity @Table(name="performance_sections")
public class PerformanceSection {
  @Id @GeneratedValue(strategy=GenerationType.IDENTITY) Long id;
  @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="template_id",nullable=false) PerformanceTemplate template;
  @Column(name="section_code",nullable=false) String code;
  @Column(name="section_name",nullable=false) String name;
  @Column(name="section_weight",nullable=false) BigDecimal weight;
  @Column(name="sort_order",nullable=false) int sortOrder;
  @Version @Column(nullable=false) Long version=0L;
  @OneToMany(mappedBy="section",cascade=CascadeType.ALL,orphanRemoval=true) @OrderBy("sortOrder ASC") List<PerformanceItem> items=new ArrayList<>();
  protected PerformanceSection() {}
  public PerformanceSection(PerformanceTemplate t,String c,String n,BigDecimal w,int order){template=t;code=c;name=n;weight=w;sortOrder=order;}
  public Long getId(){return id;} public String getCode(){return code;} public String getName(){return name;} public BigDecimal getWeight(){return weight;} public int getSortOrder(){return sortOrder;} public List<PerformanceItem> getItems(){return items;}
}
