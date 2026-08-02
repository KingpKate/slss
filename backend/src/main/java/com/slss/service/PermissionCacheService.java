package com.slss.service;

import com.slss.domain.User;
import com.slss.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/** Versioned permission cache. The database version is the cross-instance
 * invalidation signal; a local map avoids rebuilding the same effective set
 * while the version is unchanged. */
@Service
public class PermissionCacheService {
  public record EffectivePermissions(Set<String> allowed, Set<String> denied, Map<String,List<String>> sources, Map<String,String> scopes, long version) {}
  private final UserRepository users; private final PermissionOverrideRepository overrides; private final PermissionScopeBindingRepository scopes; private final PermissionCacheVersionRepository versions;
  private final Map<String,EffectivePermissions> cache=new ConcurrentHashMap<>();
  public PermissionCacheService(UserRepository u,PermissionOverrideRepository o,PermissionScopeBindingRepository s,PermissionCacheVersionRepository v){users=u;overrides=o;scopes=s;versions=v;}
  @Transactional(readOnly=true)
  public EffectivePermissions evaluate(String username){
    var user=users.findByUsernameAndStatus(username,"ACTIVE").orElse(null); if(user==null)return new EffectivePermissions(Set.of(),Set.of(),Map.of(),Map.of(),0);
    long version=versions.findById(1L).map(com.slss.domain.PermissionCacheVersion::getVersion).orElse(0L);
    var hit=cache.get(username); if(hit!=null&&hit.version()==version)return hit;
    Map<String,List<String>> sources=new HashMap<>(); Set<String> allowed=new HashSet<>();
    var personalPrefix="USER_"+user.getId()+"_CUSTOM";
    user.getRoles().forEach(role->role.getPermissions().forEach(p->{allowed.add(p.getCode());sources.computeIfAbsent(p.getCode(),k->new ArrayList<>()).add(role.getCode().startsWith(personalPrefix)?"个人直授":"角色："+role.getCode());}));
    user.getGroups().stream().filter(g->g.isEnabled()&&g.getDeletedAt()==null).forEach(group->group.getPermissions().forEach(p->{allowed.add(p.getCode());sources.computeIfAbsent(p.getCode(),k->new ArrayList<>()).add("群组："+group.getName());}));
    Set<String> denied=overrides.findByUserId(user.getId()).stream().filter(x->"DENY".equalsIgnoreCase(x.getEffect())).map(x->normalize(x.getPermissionCode())).collect(Collectors.toSet());
    overrides.findByUserId(user.getId()).stream().filter(x->"ALLOW".equalsIgnoreCase(x.getEffect())).map(x->normalize(x.getPermissionCode())).forEach(p->{allowed.add(p);sources.computeIfAbsent(p,k->new ArrayList<>()).add("个人覆盖");});
    allowed.removeAll(denied);
    Map<String,String> scopeMap=new HashMap<>();
    scopes.findBySubjectTypeAndSubjectId("USER",user.getId()).forEach(x->scopeMap.put(x.getPermissionCode(),x.getScopeType()+ (x.getScopeValue()==null?"":"="+x.getScopeValue())));
    user.getGroups().stream().filter(g->g.isEnabled()&&g.getDeletedAt()==null).forEach(g->scopes.findBySubjectTypeAndSubjectId("GROUP",g.getId()).forEach(x->scopeMap.putIfAbsent(x.getPermissionCode(),x.getScopeType()+(x.getScopeValue()==null?"":"="+x.getScopeValue()))));
    var result=new EffectivePermissions(Set.copyOf(allowed),Set.copyOf(denied),sources.entrySet().stream().collect(Collectors.toUnmodifiableMap(Map.Entry::getKey,e->List.copyOf(e.getValue()))),Map.copyOf(scopeMap),version); cache.put(username,result); return result;
  }
  @Transactional public void bump(){var row=versions.findById(1L).orElseGet(()->new com.slss.domain.PermissionCacheVersion(1L));row.bump();versions.save(row);cache.clear();}
  private String normalize(String code){return code==null?"":code.startsWith("PERM_")?code.substring(5):code;}
}
