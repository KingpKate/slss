package com.slss.service;

import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;
import java.time.Duration;

@Component
@ConditionalOnProperty(name="slss.import.executor", havingValue="rabbit")
public class RabbitProductionImportTaskQueue implements ProductionImportTaskQueue {
 private final RabbitTemplate rabbit;
 private final StringRedisTemplate redis;
 private final ProductionImportAsyncService worker;
 private final String queue;
 private final String exchange; private final long baseDelay;
 public RabbitProductionImportTaskQueue(RabbitTemplate rabbit,StringRedisTemplate redis,ProductionImportAsyncService worker,@Value("${slss.import.queue}") String queue,@Value("${slss.import.exchange:slss.import.exchange}") String exchange,@Value("${slss.import.retry-base-ms:30000}") long baseDelay){
  this.rabbit=rabbit;this.redis=redis;this.worker=worker;this.queue=queue;this.exchange=exchange;this.baseDelay=baseDelay;
 }
 public void dispatch(Long jobId){rabbit.convertAndSend(exchange,"execute",jobId);}
 @RabbitListener(queues="${slss.import.queue}", concurrency="${slss.import.rabbit.concurrency:2}")
 public void consume(Long jobId){
  String key="slss:import:lock:"+jobId;
  if(!Boolean.TRUE.equals(redis.opsForValue().setIfAbsent(key,"1",Duration.ofMinutes(30))))return;
  var renewer=java.util.concurrent.Executors.newSingleThreadScheduledExecutor();
  var renewal=renewer.scheduleAtFixedRate(()->redis.expire(key,Duration.ofMinutes(30)),60,60,java.util.concurrent.TimeUnit.SECONDS);
  try{
   worker.markQueued(jobId);worker.execute(jobId);
   var job=workerJob(jobId);
   if("FAILED".equals(job.getStatus())){
    if(job.getRetryCount()<job.getMaxRetries()){
     long delay=baseDelay*(1L<<job.getRetryCount());worker.scheduleRetry(jobId,Math.max(1,delay/1000));
     rabbit.convertAndSend(exchange,"retry",jobId,m->{m.getMessageProperties().setExpiration(String.valueOf(delay));return m;});
    }else throw new org.springframework.amqp.AmqpRejectAndDontRequeueException("导入任务超过最大重试次数");
   }
  }finally{renewal.cancel(true);renewer.shutdownNow();redis.delete(key);}
 }
 private com.slss.domain.ProductionImportJob workerJob(Long id){return worker.get(id);}
}
