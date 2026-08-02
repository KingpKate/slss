package com.slss.repository;
import com.slss.domain.PermissionGroup;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
public interface PermissionGroupRepository extends JpaRepository<PermissionGroup, Long> {
  Optional<PermissionGroup> findByCodeAndDeletedAtIsNull(String code);
  Optional<PermissionGroup> findByIdAndDeletedAtIsNull(Long id);
  java.util.List<PermissionGroup> findAllByDeletedAtIsNullOrderByNameAsc();
  long countByDeletedAtIsNull();
}
