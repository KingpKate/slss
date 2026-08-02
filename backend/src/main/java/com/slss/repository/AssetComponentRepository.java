package com.slss.repository;
import com.slss.domain.AssetComponent; import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List; import java.util.Optional;
public interface AssetComponentRepository extends JpaRepository<AssetComponent,Long>{boolean existsBySerialNo(String serialNo); Optional<AssetComponent> findBySerialNo(String serialNo); Optional<AssetComponent> findBySerialNoIgnoreCase(String serialNo); List<AssetComponent> findByAssetIdOrderById(Long assetId); Optional<AssetComponent> findByAssetIdAndComponentType(Long assetId,String componentType); Optional<AssetComponent> findByAssetIdAndSerialNoIgnoreCase(Long assetId,String serialNo);}
