package com.slss.domain;

import jakarta.persistence.*;
import java.time.Instant;

@Entity @Table(name="performance_cycles")
public class PerformanceCycle {
  @Id @GeneratedValue(strategy=GenerationType.IDENTITY) Long id;
  @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="tenant_id") CustomerTenant tenant;
  @Column(name="period_code",nullable=false) String periodCode;
  @Column(nullable=false) String status="OPEN";
  @Column(name="opened_at") Instant openedAt;
  @Column(name="closed_at") Instant closedAt;
  @Column(name="starts_at") Instant startsAt;
  @Column(name="ends_at") Instant endsAt;
  @Column(name="published_at") Instant publishedAt;
  @Column(name="due_at") Instant dueAt;
  @Version @Column(nullable=false) Long version=0L;
  protected PerformanceCycle() {}
  public PerformanceCycle(String period){periodCode=period;status="OPEN";openedAt=Instant.now();}
  public Long getId(){return id;} public String getPeriodCode(){return periodCode;} public String getStatus(){return status;} public CustomerTenant getTenant(){return tenant;} public Long getVersion(){return version;} public Instant getStartsAt(){return startsAt;} public Instant getEndsAt(){return endsAt;} public Instant getPublishedAt(){return publishedAt;} public Instant getDueAt(){return dueAt;}
  public void setStartsAt(Instant value){startsAt=value;} public void setEndsAt(Instant value){endsAt=value;} public void setPublishedAt(Instant value){publishedAt=value;} public void setDueAt(Instant value){dueAt=value;} public void setStatus(String value){status=value;}
}
