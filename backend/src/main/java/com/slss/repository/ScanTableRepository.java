package com.slss.repository;
import com.slss.domain.ScanTable;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import java.util.*;
public interface ScanTableRepository extends JpaRepository<ScanTable,Long>{
 List<ScanTable> findByStatusOrderByCreatedAtDesc(String status);
 Page<ScanTable> findByStatus(String status, Pageable pageable);
}
