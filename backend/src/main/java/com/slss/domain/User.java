package com.slss.domain;
import jakarta.persistence.*; import java.util.*; import java.time.Instant;
@Entity @Table(name="users") public class User {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) Long id;
 @Column(nullable=false,unique=true) String username;
 @Column(name="password_hash",nullable=false) String passwordHash;
 @Column(nullable=false) String status="ACTIVE";
 @Column(name="failed_login_attempts",nullable=false) int failedLoginAttempts;
 @Column(name="locked_until") Instant lockedUntil;
 @Column(name="must_change_password",nullable=false) boolean mustChangePassword=false;
 @Column(name="last_login_at") Instant lastLoginAt;
 @ManyToMany(fetch=FetchType.EAGER) @JoinTable(name="user_roles",joinColumns=@JoinColumn(name="user_id"),inverseJoinColumns=@JoinColumn(name="role_id")) Set<Role> roles=new HashSet<>();
 @ManyToMany(fetch=FetchType.EAGER) @JoinTable(name="user_permission_groups",joinColumns=@JoinColumn(name="user_id"),inverseJoinColumns=@JoinColumn(name="group_id")) Set<PermissionGroup> groups=new HashSet<>();
 protected User(){} public User(String username,String passwordHash){this.username=username;this.passwordHash=passwordHash;}
 public Long getId(){return id;} public String getUsername(){return username;} public void setUsername(String v){username=v;} public String getPasswordHash(){return passwordHash;} public String getStatus(){return status;} public int getFailedLoginAttempts(){return failedLoginAttempts;} public Instant getLockedUntil(){return lockedUntil;} public boolean isMustChangePassword(){return mustChangePassword;} public Instant getLastLoginAt(){return lastLoginAt;} public Set<Role> getRoles(){return roles;} public void setRoles(Set<Role> v){roles=v;} public Set<PermissionGroup> getGroups(){return groups;} public void setGroups(Set<PermissionGroup> v){groups=v;} public void setPasswordHash(String v){passwordHash=v;} public void setStatus(String v){status=v;} public void setFailedLoginAttempts(int v){failedLoginAttempts=v;} public void setLockedUntil(Instant v){lockedUntil=v;} public void setMustChangePassword(boolean v){mustChangePassword=v;} public void setLastLoginAt(Instant v){lastLoginAt=v;}
}
