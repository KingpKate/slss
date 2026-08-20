package com.slss.repository;
import com.slss.domain.ProductionImportJob; import org.springframework.data.jpa.repository.*; import org.springframework.data.repository.query.Param; import java.time.Instant;
public interface ProductionImportJobRepository extends JpaRepository<ProductionImportJob,Long>{
 @Modifying
 @org.springframework.transaction.annotation.Transactional
 @Query("update ProductionImportJob j set j.status='RUNNING', j.startedAt=:now, j.lastHeartbeatAt=:now, j.nextAttemptAt=null where j.id=:id and j.status in ('QUEUED','RETRY_SCHEDULED')")
 int claimForExecution(@Param("id") Long id,@Param("now") Instant now);
}
