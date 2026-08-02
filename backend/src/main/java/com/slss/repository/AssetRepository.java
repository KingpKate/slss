package com.slss.repository;
import com.slss.domain.Asset; import org.springframework.data.jpa.repository.JpaRepository; import java.util.Optional;
public interface AssetRepository extends JpaRepository<Asset,Long> {
 Optional<Asset> findByMachineSnIgnoreCase(String machineSn);
 Optional<Asset> findByBatch_IdAndMachineSnIgnoreCase(Long batchId, String machineSn);
}
