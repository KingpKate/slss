package com.slss.repository;
import com.slss.domain.User; import org.springframework.data.jpa.repository.JpaRepository; import java.util.Optional;
public interface UserRepository extends JpaRepository<User,Long>{Optional<User> findByUsernameAndStatus(String username,String status);}
