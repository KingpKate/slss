package com.slss.domain;

import jakarta.persistence.*;
import java.time.Instant;

@Entity @Table(name="user_department_memberships")
public class UserDepartmentMembership {
  @EmbeddedId MembershipId id;
  @ManyToOne(fetch=FetchType.LAZY) @MapsId("userId") @JoinColumn(name="user_id") User user;
  @ManyToOne(fetch=FetchType.LAZY) @MapsId("departmentId") @JoinColumn(name="department_id") PerformanceDepartment department;
  @Column(name="is_primary",nullable=false) boolean primaryMembership;
  @Column(name="effective_from",nullable=false,insertable=false,updatable=false) Instant effectiveFrom=Instant.now();
  @Column(name="effective_to") Instant effectiveTo;
  protected UserDepartmentMembership() {}
  public UserDepartmentMembership(User user,PerformanceDepartment department,boolean primary){this.user=user;this.department=department;this.primaryMembership=primary;this.effectiveFrom=Instant.now();this.id=new MembershipId(user.getId(),department.getId(),this.effectiveFrom);}
  public PerformanceDepartment getDepartment(){return department;} public boolean isPrimaryMembership(){return primaryMembership;} public void setPrimaryMembership(boolean value){primaryMembership=value;} public void setEffectiveTo(Instant value){effectiveTo=value;} public Instant getEffectiveTo(){return effectiveTo;}
  @Embeddable public static class MembershipId implements java.io.Serializable {
    @Column(name="user_id") Long userId;
    @Column(name="department_id") Long departmentId;
    @Column(name="effective_from") Instant effectiveFrom;
    public MembershipId(){}
    public MembershipId(Long u,Long d){this(u,d,Instant.now());}
    public MembershipId(Long u,Long d,Instant effectiveFrom){userId=u;departmentId=d;this.effectiveFrom=effectiveFrom;}
    public int hashCode(){return java.util.Objects.hash(userId,departmentId,effectiveFrom);}
    public boolean equals(Object o){return o instanceof MembershipId x&&java.util.Objects.equals(userId,x.userId)&&java.util.Objects.equals(departmentId,x.departmentId)&&java.util.Objects.equals(effectiveFrom,x.effectiveFrom);}
  }
}
