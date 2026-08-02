package com.slss.repository;
import com.slss.domain.Permission;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
public interface PermissionRepository extends JpaRepository<Permission,Long>{ Optional<Permission> findByCode(String code); }
