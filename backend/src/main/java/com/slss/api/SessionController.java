package com.slss.api;
import com.slss.repository.RefreshTokenRepository; import org.springframework.security.access.prepost.PreAuthorize; import org.springframework.web.bind.annotation.*; import java.security.Principal; import java.time.Instant; import org.springframework.http.HttpStatus; import org.springframework.web.server.ResponseStatusException;
@RestController @RequestMapping("/api/v1/sessions")
public class SessionController { private final RefreshTokenRepository tokens; public SessionController(RefreshTokenRepository t){tokens=t;} public record SessionResponse(Long id,String username,String userAgent,String ipAddress,Instant createdAt,Instant expiresAt,boolean revoked){}
 private SessionResponse response(com.slss.domain.RefreshToken t){return new SessionResponse(t.getId(),t.getUsername(),t.getUserAgent(),t.getIpAddress(),t.getCreatedAt(),t.getExpiresAt(),t.getRevokedAt()!=null);}
 @GetMapping("/me") public Object mine(Principal p){return tokens.findByUsernameOrderByCreatedAtDesc(p.getName()).stream().map(this::response).toList();}
 @GetMapping @PreAuthorize("hasAuthority('PERM_MANAGE_SYSTEM')") public Object all(){return tokens.findAll().stream().sorted(java.util.Comparator.comparing(com.slss.domain.RefreshToken::getCreatedAt).reversed()).map(this::response).toList();}
 @DeleteMapping("/{id}") public void revoke(@PathVariable Long id,Principal p){var t=tokens.findById(id).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"会话不存在"));if(!t.getUsername().equals(p.getName()))throw new org.springframework.security.access.AccessDeniedException("forbidden");t.setRevokedAt(Instant.now());tokens.save(t);}
 @DeleteMapping("/users/{username}") @PreAuthorize("hasAuthority('PERM_MANAGE_SYSTEM')") public void revokeUser(@PathVariable String username){for(var t:tokens.findByUsernameOrderByCreatedAtDesc(username)){t.setRevokedAt(Instant.now());tokens.save(t);}}
 @DeleteMapping("/admin/{id}") @PreAuthorize("hasAuthority('PERM_MANAGE_SYSTEM')") public void revokeAny(@PathVariable Long id){var t=tokens.findById(id).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"会话不存在"));t.setRevokedAt(Instant.now());tokens.save(t);}
}
