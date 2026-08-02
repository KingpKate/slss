package com.slss.repository;
import com.slss.domain.LifecycleEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import java.util.List;
import java.time.Instant;
import org.springframework.data.repository.query.Param;
public interface LifecycleEventRepository extends JpaRepository<LifecycleEvent,Long>{
 @Query("select e from LifecycleEvent e where e.asset.id=:assetId order by e.occurredAt asc") List<LifecycleEvent> findByAssetIdOrderByOccurredAtAsc(@Param("assetId") Long assetId);
 @Query("select e.partName,count(e) from LifecycleEvent e where e.eventType='REPAIR_SWAP' group by e.partName order by count(e) desc") List<Object[]> replacementStatistics();
 @Query("select e.asset.machineSn,e.partName,count(e) from LifecycleEvent e where e.eventType='REPAIR_SWAP' group by e.asset.machineSn,e.partName having count(e)>=2 order by count(e) desc") List<Object[]> recurringReplacementAlerts();
 List<LifecycleEvent> findByEventTypeAndOccurredAtBetween(String eventType,Instant from,Instant to);
}
