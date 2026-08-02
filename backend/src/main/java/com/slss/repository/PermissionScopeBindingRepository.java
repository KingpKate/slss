package com.slss.repository;
import com.slss.domain.PermissionScopeBinding;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;
public interface PermissionScopeBindingRepository extends JpaRepository<PermissionScopeBinding,Long>{ List<PermissionScopeBinding> findBySubjectTypeAndSubjectId(String subjectType,Long subjectId); List<PermissionScopeBinding> findBySubjectTypeAndSubjectIdIn(String subjectType,Collection<Long> subjectIds); }
