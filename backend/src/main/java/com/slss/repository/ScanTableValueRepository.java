package com.slss.repository;

import com.slss.domain.ScanTableValue;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

/** Indexed lookup used by the scan write path; never load every scan table. */
public interface ScanTableValueRepository extends JpaRepository<ScanTableValue, Long> {
  @Query("select v from ScanTableValue v join v.row r join r.scanTable t " +
      "where v.fieldValue = :value and t.tenant.id = :tenantId")
  List<ScanTableValue> findByValueAndTenant(@Param("value") String value, @Param("tenantId") Long tenantId);

  @Query("select v from ScanTableValue v join v.row r join r.scanTable t " +
      "where v.fieldValue = :value and t.tenant is null")
  List<ScanTableValue> findByValueWithoutTenant(@Param("value") String value);
}
