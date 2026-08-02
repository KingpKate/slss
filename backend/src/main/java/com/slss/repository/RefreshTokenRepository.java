package com.slss.repository;
import com.slss.domain.RefreshToken; import org.springframework.data.jpa.repository.JpaRepository; import org.springframework.data.domain.Page; import org.springframework.data.domain.Pageable; import java.util.Optional;
public interface RefreshTokenRepository extends JpaRepository<RefreshToken,Long>{Optional<RefreshToken> findByTokenHash(String hash); java.util.List<RefreshToken> findByUsernameOrderByCreatedAtDesc(String username); Page<RefreshToken> findByUsernameOrderByCreatedAtDesc(String username, Pageable pageable);}
