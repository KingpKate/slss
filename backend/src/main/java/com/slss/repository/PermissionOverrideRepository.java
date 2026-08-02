package com.slss.repository;
import com.slss.domain.PermissionOverride;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;
public interface PermissionOverrideRepository extends JpaRepository<PermissionOverride,Long>{ List<PermissionOverride> findByUserId(Long userId); Optional<PermissionOverride> findByUserIdAndPermissionCode(Long userId,String permissionCode); }
