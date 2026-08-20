package com.slss.service;

import com.slss.api.ProductionImportController;
import com.slss.domain.*;
import com.slss.repository.*;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import java.io.*;
import java.time.Instant;

@Service
public class ProductionImportAsyncService {
 private final ProductionImportJobRepository jobs;
 private final ProductionImportFailureRepository failures;
 private final ProductionImportController importer;
 public ProductionImportAsyncService(ProductionImportJobRepository jobs,ProductionImportFailureRepository failures,@org.springframework.context.annotation.Lazy ProductionImportController importer){
  this.jobs=jobs;this.failures=failures;this.importer=importer;
 }
 @Transactional
 public ProductionImportJob submit(String batch,MultipartFile file,String actor)throws IOException{
  var job=new ProductionImportJob();
  job.setBatchName(batch);job.setFileName(file.getOriginalFilename()==null?"upload.xlsx":file.getOriginalFilename());
  job.setCreatedBy(actor);job.setInputData(file.getBytes());
  return jobs.save(job);
 }
 @Transactional
 public ProductionImportJob retry(Long sourceId,String actor){
  var source=jobs.findById(sourceId).orElseThrow();
  if(!java.util.Set.of("FAILED","PARTIAL_SUCCESS","CANCELLED").contains(source.getStatus()))throw new IllegalStateException("仅失败、部分成功或已取消任务可重试");
  if(source.getInputData()==null||source.getInputData().length==0)throw new IllegalStateException("原始导入文件不存在，无法重试");
  var job=new ProductionImportJob();
  job.setBatchName(source.getBatchName()+"-retry-"+Instant.now().toEpochMilli());
  job.setFileName(source.getFileName());job.setCreatedBy(actor);job.setInputData(source.getInputData());job.setRetryOf(source);
  return jobs.save(job);
 }
 @Transactional
 public ProductionImportJob cancel(Long id){
  var job=jobs.findById(id).orElseThrow();
  if("QUEUED".equals(job.getStatus())){job.setStatus("CANCELLED");job.setFinishedAt(Instant.now());}
  else if("RUNNING".equals(job.getStatus()))job.setStatus("CANCEL_REQUESTED");
  else throw new IllegalStateException("当前状态不可取消");
  return jobs.save(job);
 }
 @Async public void executeAsync(Long id){execute(id);}
 public void execute(Long id){
  var job=jobs.findById(id).orElseThrow();
  if("CANCELLED".equals(job.getStatus())||"CANCEL_REQUESTED".equals(job.getStatus())){finishCancelled(job);return;}
  // Atomic claim prevents two queue consumers or a manual replay from
  // executing the same import concurrently.
  var claimedAt=Instant.now();
  if(jobs.claimForExecution(id,claimedAt)!=1)return;
  job=jobs.findById(id).orElseThrow();
  try{
   var result=importer.importExcel(job.getBatchName(),new ByteArrayMultipartFile(job.getFileName(),job.getInputData()));
   job=jobs.findById(id).orElseThrow();
   if("CANCEL_REQUESTED".equals(job.getStatus())){finishCancelled(job);return;}
   job.setTotalRows(result.total());job.setSuccessRows(result.success());job.setFailedRows(result.failed());
   job.setStatus(result.failed()==0?"COMPLETED":"PARTIAL_SUCCESS");
   for(var row:result.rows())if(!row.success()){
    var failure=new ProductionImportFailure();failure.setJob(job);failure.setRowNumber(row.row());failure.setMachineSn(row.machineSn());failure.setErrorMessage(row.message());failure.setErrorCategory(categorize(row.message()));failure.setRawData("{\"machineSn\":\""+escape(row.machineSn())+"\"}");failures.save(failure);
   }
  }catch(Exception e){job.setStatus("FAILED");job.setErrorMessage(e.getMessage());}
  job.setFinishedAt(Instant.now());jobs.save(job);
 }
 @Transactional public ProductionImportJob scheduleRetry(Long id,long delaySeconds){
  var job=jobs.findById(id).orElseThrow();if(!"FAILED".equals(job.getStatus())||job.getRetryCount()>=job.getMaxRetries())return job;
  job.setRetryCount(job.getRetryCount()+1);job.setStatus("RETRY_SCHEDULED");job.setNextAttemptAt(Instant.now().plusSeconds(delaySeconds));job.setFinishedAt(null);return jobs.save(job);
 }
 @Transactional public void markQueued(Long id){var job=jobs.findById(id).orElseThrow();if("RETRY_SCHEDULED".equals(job.getStatus())){job.setStatus("QUEUED");jobs.save(job);}}
 public ProductionImportJob get(Long id){return jobs.findById(id).orElseThrow();}
 private String categorize(String message){if(message==null)return "UNKNOWN";String m=message.toLowerCase();if(m.contains("重复")||m.contains("duplicate"))return "DUPLICATE";if(m.contains("必填")||m.contains("格式")||m.contains("不能为空"))return "VALIDATION";return "IMPORT";}
 private String escape(String value){return value==null?"":value.replace("\\","\\\\").replace("\"","\\\"");}
 private void finishCancelled(ProductionImportJob job){job.setStatus("CANCELLED");job.setFinishedAt(Instant.now());jobs.save(job);}
 static final class ByteArrayMultipartFile implements MultipartFile {
  private final String name;private final byte[] data; ByteArrayMultipartFile(String name,byte[] data){this.name=name;this.data=data;}
  public String getName(){return "file";} public String getOriginalFilename(){return name;} public String getContentType(){return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";} public boolean isEmpty(){return data==null||data.length==0;} public long getSize(){return data.length;} public byte[] getBytes(){return data;} public InputStream getInputStream(){return new ByteArrayInputStream(data);} public void transferTo(File dest)throws IOException{try(var out=new FileOutputStream(dest)){out.write(data);}}
 }
}
