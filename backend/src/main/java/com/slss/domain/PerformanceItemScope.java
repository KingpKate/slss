package com.slss.domain;

import jakarta.persistence.*;

@Entity @Table(name="performance_item_scopes")
public class PerformanceItemScope {
  @Id @GeneratedValue(strategy=GenerationType.IDENTITY) Long id;
  @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="item_id",nullable=false) PerformanceItem item;
  @Column(name="scope_type",nullable=false) String type;
  @Column(name="scope_value") String value;
  protected PerformanceItemScope() {}
  public PerformanceItemScope(PerformanceItem i,String t,String v){item=i;type=t;value=v;}
  public String getType(){return type;} public String getValue(){return value;}
}
