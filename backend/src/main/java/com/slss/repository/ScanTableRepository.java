package com.slss.repository;
import com.slss.domain.ScanTable;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import java.util.*;
public interface ScanTableRepository extends JpaRepository<ScanTable,Long>{
 List<ScanTable> findByStatusOrderByCreatedAtDesc(String status);
 List<ScanTable> findByStatusInOrderByCreatedAtDesc(Collection<String> statuses);
 Page<ScanTable> findByStatus(String status, Pageable pageable);
 Page<ScanTable> findByStatusAndTenant_IdIn(String status, java.util.Collection<Long> tenantIds, Pageable pageable);
 Page<ScanTable> findByStatusIn(Collection<String> statuses, Pageable pageable);
 Page<ScanTable> findByStatusInAndTenant_IdIn(Collection<String> statuses, java.util.Collection<Long> tenantIds, Pageable pageable);
}
