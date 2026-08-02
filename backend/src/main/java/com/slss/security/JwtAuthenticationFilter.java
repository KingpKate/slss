package com.slss.security;
import jakarta.servlet.*; import jakarta.servlet.http.*; import org.springframework.stereotype.Component; import org.springframework.security.core.context.SecurityContextHolder; import org.springframework.security.authentication.UsernamePasswordAuthenticationToken; import org.springframework.security.core.authority.SimpleGrantedAuthority; import org.slf4j.Logger; import org.slf4j.LoggerFactory; import java.io.*; import java.util.*;
import com.slss.repository.UserRepository;
import com.slss.service.PermissionCacheService;
@Component public class JwtAuthenticationFilter extends org.springframework.web.filter.OncePerRequestFilter {
 static final Logger log=LoggerFactory.getLogger(JwtAuthenticationFilter.class);
 final JwtService jwt; final UserRepository users; final PermissionCacheService permissions;
 public JwtAuthenticationFilter(JwtService j, UserRepository u, PermissionCacheService p){jwt=j;users=u;permissions=p;}
 protected void doFilterInternal(HttpServletRequest r,HttpServletResponse s,FilterChain c)throws ServletException,IOException{
  var h=r.getHeader("Authorization");
  if(h!=null&&h.startsWith("Bearer ")){
   try{
    var p=jwt.parse(h.substring(7)).getPayload();
    var username=p.getSubject();
    // Resolve the current user on every request so group/member/permission
    // changes take effect immediately, without waiting for token expiry.
    var current=users.findByUsernameAndStatus(username,"ACTIVE").orElse(null);
    if(current!=null){
      var codes=permissions.evaluate(username).allowed().stream().map(x->"PERM_"+x).sorted().toList();
      var a=codes.stream().map(SimpleGrantedAuthority::new).toList();
      SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(username,null,a));
    }
   }catch(Exception ex){SecurityContextHolder.clearContext();log.warn("JWT authentication rejected for {} {}: {}",r.getMethod(),r.getRequestURI(),ex.getClass().getSimpleName());}
  }
  c.doFilter(r,s);
 }
}
