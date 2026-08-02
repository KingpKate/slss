package com.slss.repository;
import com.slss.domain.BrandingHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
public interface BrandingHistoryRepository extends JpaRepository<BrandingHistory,Long> {
  List<BrandingHistory> findTop20ByOrderByCreatedAtDesc();
}
