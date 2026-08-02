package com.slss.domain;
import jakarta.persistence.*;
import com.fasterxml.jackson.annotation.JsonIgnore;
import java.time.Instant;
import java.util.*;
@Entity @Table(name="scan_table_rows",uniqueConstraints=@UniqueConstraint(name="uk_scan_row_number",columnNames={"scan_table_id","row_number"}))
public class ScanTableRow {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
 @Version @Column(nullable=false) private Long version=0L;
 @JsonIgnore @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="scan_table_id",nullable=false) private ScanTable scanTable;
 @Column(name="row_no",nullable=false) private int rowNumber;
 @Column(name="machine_sn") private String machineSn;
 @Column(nullable=false) private String status="OPEN";
 @Column(name="completed_by") private String completedBy;
 @Column(name="completed_at") private Instant completedAt;
 @OneToMany(mappedBy="row",cascade=CascadeType.ALL,orphanRemoval=true) private List<ScanTableValue> values=new ArrayList<>();
 public Long getId(){return id;} public Long getVersion(){return version;} public ScanTable getScanTable(){return scanTable;} public void setScanTable(ScanTable v){scanTable=v;} public int getRowNumber(){return rowNumber;} public void setRowNumber(int v){rowNumber=v;} public String getMachineSn(){return machineSn;} public void setMachineSn(String v){machineSn=v;} public String getStatus(){return status;} public void setStatus(String v){status=v;} public void setCompletedBy(String v){completedBy=v;} public String getCompletedBy(){return completedBy;} public List<ScanTableValue> getValues(){return values;}
 public Instant getCompletedAt(){return completedAt;} public void setCompletedAt(Instant v){completedAt=v;}
}
