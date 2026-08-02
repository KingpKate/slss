package com.slss.repository;
import com.slss.domain.LoginCaptchaChallenge; import org.springframework.data.jpa.repository.JpaRepository; import java.time.Instant; import java.util.*;
public interface LoginCaptchaChallengeRepository extends JpaRepository<LoginCaptchaChallenge,String>{ Optional<LoginCaptchaChallenge> findTopByUsernameAndIpAddressAndConsumedFalseAndExpiresAtAfterOrderByCreatedAtDesc(String username,String ip,Instant now); void deleteByExpiresAtBefore(Instant now); }
