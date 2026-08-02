package com.slss.repository;
import com.slss.domain.PermissionChangeRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;
public interface PermissionChangeRequestRepository extends JpaRepository<PermissionChangeRequest,Long>{ List<PermissionChangeRequest> findByStatusOrderByRequestedAtDesc(String status); }
