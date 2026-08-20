package com.slss.repository;
import com.slss.domain.Asset; import org.springframework.data.jpa.repository.JpaRepository; import org.springframework.data.domain.*; import java.util.*;
public interface AssetRepository extends JpaRepository<Asset,Long> {
 Optional<Asset> findByMachineSnIgnoreCase(String machineSn);
 Optional<Asset> findByBatch_IdAndMachineSnIgnoreCase(Long batchId, String machineSn);
 Page<Asset> findByTenant_IdIn(Collection<Long> tenantIds, Pageable pageable);
 Page<Asset> findByTenantIsNull(Pageable pageable);
}
