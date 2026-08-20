package com.slss.repository;
import com.slss.domain.ScanTable;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.repository.query.Param;
import java.time.Instant;
import java.util.*;
public interface ScanTableRepository extends JpaRepository<ScanTable,Long>{
 List<ScanTable> findByTenantIsNullAndCustomerNameIgnoreCase(String customerName);
 List<ScanTable> findByStatusOrderByCreatedAtDesc(String status);
 List<ScanTable> findByStatusInOrderByCreatedAtDesc(Collection<String> statuses);
 List<ScanTable> findByQualityTransferredTrueOrderByQualityTransferredAtDesc();
 List<ScanTable> findAllByOrderByCreatedAtDesc();
 Page<ScanTable> findByStatus(String status, Pageable pageable);
 Page<ScanTable> findByStatusAndTenant_IdIn(String status, java.util.Collection<Long> tenantIds, Pageable pageable);
 Page<ScanTable> findByStatusIn(Collection<String> statuses, Pageable pageable);
 Page<ScanTable> findByStatusInAndTenant_IdIn(Collection<String> statuses, java.util.Collection<Long> tenantIds, Pageable pageable);
 Page<ScanTable> findByStatusInAndTenantIsNull(Collection<String> statuses, Pageable pageable);
 @Query(value="select st.customer_name as customerName, st.model as model, count(r.id) as totalCount, sum(case when r.status='COMPLETED' then 1 else 0 end) as completedCount, sum(case when r.status NOT IN ('COMPLETED','CANCELLED') then 1 else 0 end) as unfinishedCount from scan_tables st join scan_table_rows r on r.scan_table_id=st.id where st.created_at >= :from and st.created_at < :to and st.tenant_id in (:tenantIds) group by st.customer_name, st.model", nativeQuery=true)
 List<ScanProductionAggregate> productionAggregate(@Param("tenantIds") Collection<Long> tenantIds,@Param("from") Instant from,@Param("to") Instant to);
 @Query(value="select st.customer_name as customerName, st.model as model, count(r.id) as totalCount, sum(case when r.status='COMPLETED' then 1 else 0 end) as completedCount, sum(case when r.status NOT IN ('COMPLETED','CANCELLED') then 1 else 0 end) as unfinishedCount from scan_tables st join scan_table_rows r on r.scan_table_id=st.id where st.tenant_id in (:tenantIds) group by st.customer_name, st.model", nativeQuery=true)
 List<ScanProductionAggregate> productionAggregateCurrent(@Param("tenantIds") Collection<Long> tenantIds);
 @Query(value="select st.customer_name as customerName, st.model as model, count(r.id) as totalCount, sum(case when r.status='COMPLETED' then 1 else 0 end) as completedCount, sum(case when r.status NOT IN ('COMPLETED','CANCELLED') then 1 else 0 end) as unfinishedCount from scan_tables st join scan_table_rows r on r.scan_table_id=st.id where st.created_at >= :from and st.created_at < :to group by st.customer_name, st.model", nativeQuery=true)
 List<ScanProductionAggregate> productionAggregateAll(@Param("from") Instant from,@Param("to") Instant to);
 @Query(value="select st.customer_name as customerName, st.model as model, count(r.id) as totalCount, sum(case when r.status='COMPLETED' then 1 else 0 end) as completedCount, sum(case when r.status NOT IN ('COMPLETED','CANCELLED') then 1 else 0 end) as unfinishedCount from scan_tables st join scan_table_rows r on r.scan_table_id=st.id group by st.customer_name, st.model", nativeQuery=true)
 List<ScanProductionAggregate> productionAggregateCurrentAll();
 @Query(value="select st.customer_name as customerName, st.model as model, count(r.id) as quantity from scan_tables st join scan_table_rows r on r.scan_table_id=st.id where st.created_at >= :from and st.created_at < :to and r.status='COMPLETED' and st.tenant_id in (:tenantIds) group by st.customer_name, st.model", nativeQuery=true)
 List<ScanProductionDetailAggregate> completedDetailAggregate(@Param("tenantIds") Collection<Long> tenantIds,@Param("from") Instant from,@Param("to") Instant to);
 @Query(value="select st.customer_name as customerName, st.model as model, count(r.id) as quantity from scan_tables st join scan_table_rows r on r.scan_table_id=st.id where st.created_at >= :from and st.created_at < :to and r.status NOT IN ('COMPLETED','CANCELLED') and st.tenant_id in (:tenantIds) group by st.customer_name, st.model", nativeQuery=true)
 List<ScanProductionDetailAggregate> unfinishedDetailAggregate(@Param("tenantIds") Collection<Long> tenantIds,@Param("from") Instant from,@Param("to") Instant to);
 @Query(value="select st.customer_name as customerName, st.model as model, count(r.id) as quantity from scan_tables st join scan_table_rows r on r.scan_table_id=st.id where st.created_at >= :from and st.created_at < :to and r.status='COMPLETED' group by st.customer_name, st.model", nativeQuery=true)
 List<ScanProductionDetailAggregate> completedDetailAggregateAll(@Param("from") Instant from,@Param("to") Instant to);
 @Query(value="select st.customer_name as customerName, st.model as model, count(r.id) as quantity from scan_tables st join scan_table_rows r on r.scan_table_id=st.id where st.created_at >= :from and st.created_at < :to and r.status NOT IN ('COMPLETED','CANCELLED') group by st.customer_name, st.model", nativeQuery=true)
 List<ScanProductionDetailAggregate> unfinishedDetailAggregateAll(@Param("from") Instant from,@Param("to") Instant to);
 @Query(value="select st.customer_name as customerName, st.model as model, count(r.id) as quantity from scan_tables st join scan_table_rows r on r.scan_table_id=st.id where r.status='COMPLETED' and st.tenant_id in (:tenantIds) group by st.customer_name, st.model", nativeQuery=true)
 List<ScanProductionDetailAggregate> completedDetailAggregateCurrent(@Param("tenantIds") Collection<Long> tenantIds);
 @Query(value="select st.customer_name as customerName, st.model as model, count(r.id) as quantity from scan_tables st join scan_table_rows r on r.scan_table_id=st.id where r.status NOT IN ('COMPLETED','CANCELLED') and st.tenant_id in (:tenantIds) group by st.customer_name, st.model", nativeQuery=true)
 List<ScanProductionDetailAggregate> unfinishedDetailAggregateCurrent(@Param("tenantIds") Collection<Long> tenantIds);
 @Query(value="select st.customer_name as customerName, st.model as model, count(r.id) as quantity from scan_tables st join scan_table_rows r on r.scan_table_id=st.id where r.status='COMPLETED' group by st.customer_name, st.model", nativeQuery=true)
 List<ScanProductionDetailAggregate> completedDetailAggregateCurrentAll();
 @Query(value="select st.customer_name as customerName, st.model as model, count(r.id) as quantity from scan_tables st join scan_table_rows r on r.scan_table_id=st.id where r.status NOT IN ('COMPLETED','CANCELLED') group by st.customer_name, st.model", nativeQuery=true)
 List<ScanProductionDetailAggregate> unfinishedDetailAggregateCurrentAll();
}
