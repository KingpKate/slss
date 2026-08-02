package com.slss.service;

import com.slss.domain.User;
import com.slss.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import java.time.Duration;
import java.time.Instant;

/** Persists failed-login counters outside the endpoint transaction. */
@Service
public class LoginAttemptService {
    private final UserRepository users;
    private final AuditService audit;
    public LoginAttemptService(UserRepository users, AuditService audit) { this.users = users; this.audit = audit; }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public int recordFailure(Long userId, String username, String ipAddress) {
        User user = users.findById(userId).orElseThrow();
        int failures = user.getFailedLoginAttempts() + 1;
        user.setFailedLoginAttempts(failures);
        if (failures >= 5) user.setLockedUntil(Instant.now().plus(Duration.ofMinutes(15)));
        users.saveAndFlush(user);
        audit.recordSecurity(username, "LOGIN", "USER", String.valueOf(userId), "密码错误，第 " + failures + " 次", ipAddress, false);
        return failures;
    }
}
