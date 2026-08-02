package com.slss.service;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name="slss.import.executor", havingValue="local", matchIfMissing=true)
public class LocalProductionImportTaskQueue implements ProductionImportTaskQueue {
 private final ProductionImportAsyncService worker;
 public LocalProductionImportTaskQueue(ProductionImportAsyncService worker){this.worker=worker;}
 public void dispatch(Long jobId){worker.executeAsync(jobId);}
}
