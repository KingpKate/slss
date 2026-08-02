package com.slss.repository;
import com.slss.domain.LoginBackgroundAsset; import org.springframework.data.jpa.repository.JpaRepository; import java.util.*;
public interface LoginBackgroundAssetRepository extends JpaRepository<LoginBackgroundAsset,Long>{ List<LoginBackgroundAsset> findByEnabledTrueOrderBySortOrderAscCreatedAtAsc(); }
