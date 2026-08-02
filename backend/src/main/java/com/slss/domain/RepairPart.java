package com.slss.domain;
import jakarta.persistence.*;
@Entity @Table(name="repair_parts")
public class RepairPart { @Id @GeneratedValue(strategy=GenerationType.IDENTITY) Long id; @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="repair_order_id",nullable=false) RepairOrder order; @Column(name="part_name",nullable=false) String partName; @Column(name="old_sn") String oldSn; @Column(name="new_sn") String newSn; public Long getId(){return id;} public String getPartName(){return partName;} public String getOldSn(){return oldSn;} public String getNewSn(){return newSn;} public void setOrder(RepairOrder v){order=v;} public void setPartName(String v){partName=v;} public void setOldSn(String v){oldSn=v;} public void setNewSn(String v){newSn=v;} }
