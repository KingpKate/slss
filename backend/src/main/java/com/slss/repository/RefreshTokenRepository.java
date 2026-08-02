package com.slss.repository;
import com.slss.domain.RefreshToken; import org.springframework.data.jpa.repository.JpaRepository; import java.util.Optional;
public interface RefreshTokenRepository extends JpaRepository<RefreshToken,Long>{Optional<RefreshToken> findByTokenHash(String hash); java.util.List<RefreshToken> findByUsernameOrderByCreatedAtDesc(String username);}
