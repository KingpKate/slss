package com.slss.domain;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "lifecycle_events")
public class LifecycleEvent {
  @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
  @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "asset_id", nullable = false) private Asset asset;
  @Column(name = "event_type", nullable = false) private String eventType;
  @Column(name = "part_name") private String partName;
  @Column(name = "old_sn") private String oldSn;
  @Column(name = "new_sn") private String newSn;
  @Column(columnDefinition = "TEXT") private String details;
  @Column(name = "fault_description", columnDefinition = "TEXT") private String faultDescription;
  @Column(name = "occurred_at", nullable = false) private Instant occurredAt = Instant.now();
  public Long getId(){return id;} public String getEventType(){return eventType;} public String getPartName(){return partName;} public String getOldSn(){return oldSn;} public String getNewSn(){return newSn;} public String getDetails(){return details;} public String getFaultDescription(){return faultDescription;} public Instant getOccurredAt(){return occurredAt;}
  public Long getAssetId(){return asset==null?null:asset.getId();} public String getBatchName(){return asset==null||asset.getBatch()==null?null:asset.getBatch().getBatchName();}
  public CustomerTenant getTenant(){return asset==null?null:asset.getTenant()!=null?asset.getTenant():(asset.getBatch()==null?null:asset.getBatch().getTenant());}
  public String getMachineSn(){return asset==null?null:asset.getMachineSn();} public String getAssetModel(){return asset==null?null:asset.getModel();}
  public void setAsset(Asset v){asset=v;} public void setEventType(String v){eventType=v;} public void setPartName(String v){partName=v;} public void setOldSn(String v){oldSn=v;} public void setNewSn(String v){newSn=v;} public void setDetails(String v){details=v;} public void setFaultDescription(String v){faultDescription=v;}
}
