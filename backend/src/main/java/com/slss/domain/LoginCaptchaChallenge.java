package com.slss.domain;
import jakarta.persistence.*; import java.time.Instant;
@Entity @Table(name="login_captcha_challenges", indexes=@Index(name="idx_login_captcha_lookup", columnList="username,ip_address,expires_at"))
public class LoginCaptchaChallenge {
 @Id @Column(length=64) private String id;
 @Column(nullable=false,length=120) private String username;
 @Column(name="ip_address",nullable=false,length=64) private String ipAddress;
 @Column(name="answer_hash",nullable=false,length=128) private String answerHash;
 @Column(name="expires_at",nullable=false) private Instant expiresAt;
 @Column(nullable=false) private int attempts;
 @Column(name="max_attempts",nullable=false) private int maxAttempts;
 @Column(nullable=false) private boolean consumed;
 @Column(name="created_at",nullable=false) private Instant createdAt=Instant.now();
 public String getId(){return id;} public void setId(String v){id=v;} public String getUsername(){return username;} public void setUsername(String v){username=v;} public String getIpAddress(){return ipAddress;} public void setIpAddress(String v){ipAddress=v;} public String getAnswerHash(){return answerHash;} public void setAnswerHash(String v){answerHash=v;} public Instant getExpiresAt(){return expiresAt;} public void setExpiresAt(Instant v){expiresAt=v;} public int getAttempts(){return attempts;} public void setAttempts(int v){attempts=v;} public int getMaxAttempts(){return maxAttempts;} public void setMaxAttempts(int v){maxAttempts=v;} public boolean isConsumed(){return consumed;} public void setConsumed(boolean v){consumed=v;} public Instant getCreatedAt(){return createdAt;} public void setCreatedAt(Instant v){createdAt=v;}
}
