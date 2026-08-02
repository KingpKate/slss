package com.slss.repository;
import com.slss.domain.AuditLog; import org.springframework.data.jpa.repository.JpaRepository; import org.springframework.data.domain.*; 
public interface AuditLogRepository extends JpaRepository<AuditLog,Long>{Page<AuditLog> findByActionContainingIgnoreCase(String action, Pageable pageable);}
