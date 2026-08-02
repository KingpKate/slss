package com.slss.repository;
import com.slss.domain.UserTenantLink; import org.springframework.data.jpa.repository.JpaRepository;
public interface UserTenantLinkRepository extends JpaRepository<UserTenantLink,UserTenantLink.Key>{}
