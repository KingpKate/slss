package com.slss.domain;
import jakarta.persistence.*; import java.util.*;
@Entity @Table(name="roles") public class Role {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) Long id;
 @Column(nullable=false,unique=true) String code;
 @Column(nullable=false) String name;
 @ManyToMany(fetch=FetchType.EAGER) @JoinTable(name="role_permissions",joinColumns=@JoinColumn(name="role_id"),inverseJoinColumns=@JoinColumn(name="permission_id")) Set<Permission> permissions=new HashSet<>();
 protected Role(){}
 public Role(String code){this.code=code;this.name=code;}
 public String getCode(){return code;}
 public String getName(){return name;}
 public Set<Permission> getPermissions(){return permissions;}
}
