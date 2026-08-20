package com.slss.domain;
import jakarta.persistence.*;
import com.fasterxml.jackson.annotation.JsonIgnore;
import java.time.Instant;
@Entity @Table(name="scan_table_values",uniqueConstraints=@UniqueConstraint(name="uk_scan_value_field",columnNames={"row_id","field_key"}))
public class ScanTableValue {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
 @JsonIgnore @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="row_id",nullable=false) private ScanTableRow row;
 @Column(name="field_key",nullable=false) private String fieldKey;
 @Column(name="field_value") private String fieldValue;
 @Column(name="operator_no") private String operatorNo;
 @Column(name="scanned_at") private Instant scannedAt;
 public Long getId(){return id;} public ScanTableRow getRow(){return row;} public void setRow(ScanTableRow v){row=v;} public String getFieldKey(){return fieldKey;} public void setFieldKey(String v){fieldKey=v;} public String getFieldValue(){return fieldValue;} public void setFieldValue(String v){fieldValue=v;} public String getOperatorNo(){
   var completed=(row!=null&&row.getCompletedProcessKeys()!=null&&fieldKey!=null&&(row.getCompletedProcessKeys().contains(fieldKey+",")||row.getCompletedProcessKeys().endsWith(fieldKey)));
   if((operatorNo==null||operatorNo.isBlank())&&completed) return row.getCompletedBy();
   return operatorNo;
 } public void setOperatorNo(String v){operatorNo=v;} public Instant getScannedAt(){return scannedAt;} public void setScannedAt(Instant v){scannedAt=v;}
}
