package com.slss.api;
import jakarta.validation.*; import jakarta.validation.constraints.NotBlank; import jakarta.servlet.http.*; import org.springframework.web.bind.annotation.*; import java.util.*; import java.time.*; import java.security.*; import java.nio.charset.StandardCharsets; import com.slss.repository.*; import com.slss.domain.RefreshToken; import com.slss.security.JwtService; import com.slss.service.AuditService; import com.slss.service.PermissionCacheService; import com.slss.service.LoginAttemptService; import org.springframework.security.crypto.password.PasswordEncoder; import org.springframework.web.server.ResponseStatusException; import org.springframework.http.HttpStatus; import org.springframework.transaction.annotation.Transactional;
@RestController @RequestMapping("/api/v1/auth") public class AuthController {
 final UserRepository users; final PasswordEncoder encoder; final JwtService jwt; final AuditService audit; final RefreshTokenRepository refreshTokens; final PermissionCacheService permissionCache; final LoginAttemptService loginAttempts; final com.slss.service.CaptchaService captcha;
 public AuthController(UserRepository u,PasswordEncoder e,JwtService j,AuditService a,RefreshTokenRepository r,PermissionCacheService p,LoginAttemptService la,com.slss.service.CaptchaService captcha){users=u;encoder=e;jwt=j;audit=a;refreshTokens=r;permissionCache=p;loginAttempts=la;this.captcha=captcha;}
 public record LoginRequest(@NotBlank String username,@NotBlank String password,String captchaToken,String captchaAnswer){ public LoginRequest(String username,String password){this(username,password,null,null);} }
 public record LoginResponse(String token,String tokenType,String username,List<String> authorities,boolean mustChangePassword){}
 public record CaptchaStatusResponse(boolean enabled, boolean required){}
 @GetMapping("/me") @Transactional(readOnly=true) public LoginResponse me(Principal principal){
  if(principal==null)throw unauthorized();
  var u=users.findByUsernameAndStatus(principal.getName(),"ACTIVE").orElseThrow(this::unauthorized);
  var authorities=authorities(u);
  return new LoginResponse(null,"Bearer",u.getUsername(),authorities,false);
 }

 @GetMapping("/captcha/status") public CaptchaStatusResponse captchaStatus(@RequestParam String username){ var u=users.findByUsernameAndStatus(username,"ACTIVE").orElse(null); var result=captcha.status(username,u==null?0L:(long)u.getFailedLoginAttempts()); return new CaptchaStatusResponse(result.enabled(), result.required()); }
 @PostMapping("/captcha/challenge") public com.slss.service.CaptchaService.Challenge captchaChallenge(@RequestBody Map<String,String> body,HttpServletRequest request){ String username=body==null?null:body.get("username"); if(username==null||username.isBlank()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"用户名不能为空"); var u=users.findByUsernameAndStatus(username,"ACTIVE").orElseThrow(this::unauthorized); var st=captcha.status(username,(long)u.getFailedLoginAttempts()); if(!st.required()) throw new ResponseStatusException(HttpStatus.CONFLICT,"当前不需要验证码"); return captcha.issue(username,request.getRemoteAddr()); }
 @PostMapping("/login") @Transactional public LoginResponse login(@Valid @RequestBody LoginRequest r,HttpServletRequest request,HttpServletResponse response){
  var u=users.findByUsernameAndStatus(r.username(),"ACTIVE").orElse(null);var ip=request.getRemoteAddr();
  if(u==null){audit.recordSecurity(r.username(),"LOGIN","USER",r.username(),"账号不存在",ip,false);throw unauthorized();}
  if(u.getLockedUntil()!=null&&u.getLockedUntil().isAfter(Instant.now())){audit.recordSecurity(r.username(),"LOGIN","USER",String.valueOf(u.getId()),"账号锁定",ip,false);throw new ResponseStatusException(HttpStatus.LOCKED,"账号已锁定，请稍后重试");}
  var captchaStatus=captcha.status(r.username(),(long)u.getFailedLoginAttempts());
  if(captchaStatus.required()&&!captcha.verify(r.captchaToken(),r.username(),ip,r.captchaAnswer())) throw new ResponseStatusException(HttpStatus.FORBIDDEN,"需要有效验证码");
  if(!encoder.matches(r.password(),u.getPasswordHash())){loginAttempts.recordFailure(u.getId(),r.username(),ip);throw unauthorized();}
  u.setFailedLoginAttempts(0);u.setLockedUntil(null);u.setLastLoginAt(Instant.now());users.save(u);var authorities=authorities(u);var token=jwt.issue(u.getUsername(),authorities);issueRefreshCookie(u.getUsername(),request,response);audit.record(u.getUsername(),"LOGIN","USER",String.valueOf(u.getId()),"登录成功",ip,true);return new LoginResponse(token,"Bearer",u.getUsername(),authorities,false);
 }
 @PostMapping("/refresh") @Transactional public LoginResponse refresh(@CookieValue(name="slss_refresh",required=false) String refresh,HttpServletRequest request,HttpServletResponse response){
  if(refresh==null)throw unauthorized();
  var stored=refreshTokens.findByTokenHash(hash(refresh)).orElseThrow(this::unauthorized);
  if(stored.getRevokedAt()!=null||stored.getExpiresAt().isBefore(Instant.now()))throw unauthorized();
  stored.setRevokedAt(Instant.now());refreshTokens.save(stored);
  var u=users.findByUsernameAndStatus(stored.getUsername(),"ACTIVE").orElseThrow(this::unauthorized);
  var authorities=authorities(u);issueRefreshCookie(u.getUsername(),request,response);
  return new LoginResponse(jwt.issue(u.getUsername(),authorities),"Bearer",u.getUsername(),authorities,false);
 }
 @PostMapping("/logout") @Transactional public void logout(@CookieValue(name="slss_refresh",required=false) String refresh,HttpServletRequest request,HttpServletResponse response){if(refresh!=null)refreshTokens.findByTokenHash(hash(refresh)).ifPresent(t->{t.setRevokedAt(Instant.now());refreshTokens.save(t);});var c=new Cookie("slss_refresh","");c.setMaxAge(0);c.setHttpOnly(true);c.setSecure(request.isSecure());c.setPath(refreshCookiePath(request));response.addCookie(c);}
 private void issueRefreshCookie(String username,HttpServletRequest request,HttpServletResponse response){var token=jwt.issueRefresh(username);var r=new RefreshToken();r.setTokenHash(hash(token));r.setUsername(username);r.setExpiresAt(Instant.now().plus(jwt.refreshTtl()));r.setUserAgent(request.getHeader("User-Agent"));r.setIpAddress(request.getRemoteAddr());refreshTokens.save(r);var c=new Cookie("slss_refresh",token);c.setHttpOnly(true);c.setSecure(request.isSecure());c.setPath(refreshCookiePath(request));c.setMaxAge((int)jwt.refreshTtl().toSeconds());response.addCookie(c);}
 private String refreshCookiePath(HttpServletRequest request){return (request.getContextPath()==null||request.getContextPath().isBlank()?"":request.getContextPath())+"/api/v1/auth";}
 private String hash(String value){try{var bytes=MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));return HexFormat.of().formatHex(bytes);}catch(Exception e){throw new IllegalStateException(e);}}
 private ResponseStatusException unauthorized(){return new ResponseStatusException(HttpStatus.UNAUTHORIZED,"用户名或密码错误");}
 private List<String> authorities(com.slss.domain.User u){return permissionCache.evaluate(u.getUsername()).allowed().stream().map(p->"PERM_"+p).sorted().toList();}
}
