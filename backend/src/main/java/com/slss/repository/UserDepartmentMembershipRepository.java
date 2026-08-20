package com.slss.repository;
import com.slss.domain.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import java.util.*;
public interface UserDepartmentMembershipRepository extends JpaRepository<UserDepartmentMembership,UserDepartmentMembership.MembershipId>{
 @Query("select m from UserDepartmentMembership m join fetch m.department d where m.user.id=:userId and m.primaryMembership=true and m.effectiveTo is null and d.status='ACTIVE'") Optional<UserDepartmentMembership> findPrimary(@Param("userId") Long userId);
 @Query("select m from UserDepartmentMembership m where m.user.id=:userId and m.effectiveTo is null") List<UserDepartmentMembership> findActiveByUser(@Param("userId") Long userId);
 @Query("select m from UserDepartmentMembership m where m.user.id=:userId and m.department.id=:departmentId and m.effectiveTo is null order by m.effectiveFrom desc") Optional<UserDepartmentMembership> findActiveByUserAndDepartment(@Param("userId") Long userId,@Param("departmentId") Long departmentId);
}
