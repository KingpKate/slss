package com.slss.domain;

import jakarta.persistence.*;
import java.util.*;

@Entity @Table(name="performance_departments")
public class PerformanceDepartment {
  @Id @GeneratedValue(strategy=GenerationType.IDENTITY) Long id;
  @Column(name="department_code",nullable=false,unique=true,length=80) String code;
  @Column(name="department_name",nullable=false,unique=true,length=120) String name;
  @Column(nullable=false,length=20) String status="ACTIVE";
  @Version @Column(nullable=false) Long version=0L;
  protected PerformanceDepartment() {}
  public PerformanceDepartment(String code,String name){this.code=code;this.name=name;}
  public Long getId(){return id;} public String getCode(){return code;} public String getName(){return name;} public String getStatus(){return status;} public Long getVersion(){return version;}
}
