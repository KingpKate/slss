package com.slss.api;

import com.slss.domain.ProductionImportJob;
import com.slss.repository.*;
import com.slss.service.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.security.Principal;
import java.time.Instant;

@RestController
@RequestMapping("/api/v1/production/import-jobs")
@PreAuthorize("hasAuthority('PERM_MANAGE_PRODUCTION')")
public class ProductionImportJobController {
 private final ProductionImportJobRepository jobs;
 private final ProductionImportFailureRepository failures;
 private final ProductionImportAsyncService service;
 private final ProductionImportTaskQueue queue;
 public ProductionImportJobController(ProductionImportJobRepository jobs,ProductionImportFailureRepository failures,ProductionImportAsyncService service,ProductionImportTaskQueue queue){
  this.jobs=jobs;this.failures=failures;this.service=service;this.queue=queue;
 }
 public record JobResponse(Long id,String batchName,String fileName,String status,int totalRows,int successRows,int failedRows,String errorMessage,String createdBy,Instant createdAt,Instant startedAt,Instant finishedAt,Long retryOf,int retryCount,int maxRetries,Instant nextAttemptAt,Instant lastHeartbeatAt){}
 private JobResponse response(ProductionImportJob j){return new JobResponse(j.getId(),j.getBatchName(),j.getFileName(),j.getStatus(),j.getTotalRows(),j.getSuccessRows(),j.getFailedRows(),j.getErrorMessage(),j.getCreatedBy(),j.getCreatedAt(),j.getStartedAt(),j.getFinishedAt(),j.getRetryOf()==null?null:j.getRetryOf().getId(),j.getRetryCount(),j.getMaxRetries(),j.getNextAttemptAt(),j.getLastHeartbeatAt());}
 @PostMapping(consumes="multipart/form-data")
 public JobResponse submit(@RequestParam String batchName,@RequestPart MultipartFile file,Principal principal)throws Exception{
  var job=service.submit(batchName,file,principal.getName());queue.dispatch(job.getId());return response(job);
 }
 @PostMapping("/{id}/cancel") public JobResponse cancel(@PathVariable Long id){return response(service.cancel(id));}
 @PostMapping("/{id}/retry") public JobResponse retry(@PathVariable Long id,Principal principal){var job=service.retry(id,principal.getName());queue.dispatch(job.getId());return response(job);}
 @GetMapping public Object list(){return jobs.findAll().stream().map(this::response).toList();}
 @GetMapping("/{id}") public JobResponse get(@PathVariable Long id){return response(jobs.findById(id).orElseThrow());}
 @GetMapping("/{id}/failures") public Object failures(@PathVariable Long id){return failures.findByJobIdOrderByRowNumberAsc(id);}
}
