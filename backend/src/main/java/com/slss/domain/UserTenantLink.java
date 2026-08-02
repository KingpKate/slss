package com.slss.domain;
import jakarta.persistence.*;
@Entity @Table(name="user_tenants") public class UserTenantLink {
 @EmbeddedId private Key id;
 @ManyToOne(fetch=FetchType.LAZY) @MapsId("userId") @JoinColumn(name="user_id") private User user;
 @ManyToOne(fetch=FetchType.LAZY) @MapsId("tenantId") @JoinColumn(name="tenant_id") private CustomerTenant tenant;
 public UserTenantLink(){} public UserTenantLink(User u,CustomerTenant t){user=u;tenant=t;id=new Key(u.getId(),t.getId());}
 public CustomerTenant getTenant(){return tenant;}
 @Embeddable public static class Key implements java.io.Serializable {Long userId;Long tenantId;public Key(){}public Key(Long u,Long t){userId=u;tenantId=t;}}
}
