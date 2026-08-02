package com.slss.repository;
import com.slss.domain.ScanTable;
import org.springframework.data.jpa.repository.*;
import java.util.*;
public interface ScanTableRepository extends JpaRepository<ScanTable,Long>{List<ScanTable> findByStatusOrderByCreatedAtDesc(String status);}
