package com.slss.repository;
import com.slss.domain.CustomerTenant; import com.slss.domain.User; import org.springframework.data.jpa.repository.*; import org.springframework.data.repository.query.Param; import java.util.*;
public interface CustomerTenantRepository extends JpaRepository<CustomerTenant,Long>{
 Optional<CustomerTenant> findByTenantCode(String code);
 @Query("select t.id from CustomerTenant t join UserTenantLink l on l.tenant.id=t.id where l.user.id=:userId and t.status='ACTIVE'") Set<Long> findActiveIdsByUserId(@Param("userId") Long userId);
}
