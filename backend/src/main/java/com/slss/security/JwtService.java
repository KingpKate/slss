package com.slss.security;
import io.jsonwebtoken.*; import io.jsonwebtoken.security.Keys; import org.springframework.beans.factory.annotation.Value; import org.springframework.beans.factory.annotation.Autowired; import org.springframework.stereotype.Service; import javax.crypto.SecretKey; import java.nio.charset.StandardCharsets; import java.time.Duration; import java.util.*;
@Service public class JwtService { final SecretKey accessKey; final SecretKey refreshKey; final Duration ttl; final Duration refreshTtl;
 /** 默认占位前缀，出现则拒绝启动。 */
 private static final String[] DEFAULT_SECRET_PREFIXES={"change-this","replace-this","change-this-refresh"};
 @Autowired public JwtService(@Value("${slss.security.jwt-secret:change-this-secret-to-a-32-byte-production-secret}") String s,@Value("${slss.security.refresh-secret:change-this-refresh-secret-to-a-32-byte-production-secret}") String rs,@Value("${slss.security.jwt-ttl:PT8H}") Duration t,@Value("${slss.security.refresh-ttl:P30D}") Duration rt){
  rejectDefaultSecret(s,"slss.security.jwt-secret"); rejectDefaultSecret(rs,"slss.security.refresh-secret");
  if(s.getBytes(StandardCharsets.UTF_8).length<32||rs.getBytes(StandardCharsets.UTF_8).length<32)throw new IllegalArgumentException("JWT secret too short");
  accessKey=Keys.hmacShaKeyFor(s.getBytes(StandardCharsets.UTF_8));refreshKey=Keys.hmacShaKeyFor(rs.getBytes(StandardCharsets.UTF_8));ttl=t;refreshTtl=rt;
 }
 public JwtService(String s,Duration t){this(s,s+"-refresh-secret-32-bytes-minimum",t,Duration.ofDays(30));}
 private static void rejectDefaultSecret(String v,String name){if(v==null||v.isBlank())throw new IllegalStateException(name+" 未配置，拒绝启动");for(var p:DEFAULT_SECRET_PREFIXES)if(v.startsWith(p))throw new IllegalStateException(name+" 仍为默认占位值(以 "+p+" 开头)，拒绝启动");}
 public String issue(String u,List<String>a){return issueWith(accessKey,ttl,u,a,"access",false);}
 public String issueRefresh(String u){return issueWith(refreshKey,refreshTtl,u,List.of(),"refresh",false);}
 private String issueWith(SecretKey key,Duration d,String u,List<String>a,String type,boolean ignored){var n=new Date();return Jwts.builder().id(UUID.randomUUID().toString()).subject(u).claim("authorities",a).claim("type",type).issuedAt(n).expiration(new Date(n.getTime()+d.toMillis())).signWith(key).compact();}
 public Jws<Claims> parse(String t){return Jwts.parser().verifyWith(accessKey).build().parseSignedClaims(t);}
 public Jws<Claims> parseRefresh(String t){return Jwts.parser().verifyWith(refreshKey).build().parseSignedClaims(t);}
 public Duration refreshTtl(){return refreshTtl;}
}
