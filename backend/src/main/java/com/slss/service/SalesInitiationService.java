package com.slss.service;
import com.slss.domain.*; import com.slss.repository.*; import jakarta.transaction.Transactional; import org.springframework.http.*; import org.springframework.security.core.context.SecurityContextHolder; import org.springframework.stereotype.Service; import org.springframework.web.server.ResponseStatusException; import java.time.LocalDate; import java.util.*;
@Service public class SalesInitiationService {
 private final SalesInitiationRepository initiations; private final SalesApprovalHistoryRepository history; private final ProcurementProjectRepository procurement;
 private static final Map<SalesInitiationStatus,Set<SalesInitiationStatus>> FLOW=Map.of(
  SalesInitiationStatus.DRAFT,Set.of(SalesInitiationStatus.SUBMITTED,SalesInitiationStatus.CANCELLED),
  SalesInitiationStatus.SUBMITTED,Set.of(SalesInitiationStatus.SALES_REVIEW,SalesInitiationStatus.REJECTED,SalesInitiationStatus.CANCELLED),
  SalesInitiationStatus.SALES_REVIEW,Set.of(SalesInitiationStatus.PROCUREMENT_PENDING,SalesInitiationStatus.REJECTED),
  SalesInitiationStatus.PROCUREMENT_PENDING,Set.of(SalesInitiationStatus.QUOTING,SalesInitiationStatus.CANCELLED),
  SalesInitiationStatus.QUOTING,Set.of(SalesInitiationStatus.QUOTED,SalesInitiationStatus.CANCELLED),
  SalesInitiationStatus.QUOTED,Set.of(SalesInitiationStatus.APPROVED,SalesInitiationStatus.REJECTED));
 public SalesInitiationService(SalesInitiationRepository i,SalesApprovalHistoryRepository h,ProcurementProjectRepository p){initiations=i;history=h;procurement=p;}
 @Transactional public SalesInitiation create(SalesInitiation item){item.setInitiationNo("SI-"+java.time.Year.now().getValue()+"-"+UUID.randomUUID().toString().substring(0,8).toUpperCase());return initiations.save(item);}
 @Transactional public SalesInitiation transition(Long id,SalesInitiationStatus target,String comment){
  var item=get(id);var from=item.getStatus();if(!FLOW.getOrDefault(from,Set.of()).contains(target))throw new ResponseStatusException(HttpStatus.CONFLICT,"非法销售立项状态转移: "+from+" -> "+target);
  if((target==SalesInitiationStatus.REJECTED||target==SalesInitiationStatus.CANCELLED)&&(comment==null||comment.isBlank()))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"驳回或取消必须填写原因");
  item.setStatus(target);var saved=initiations.save(item);var h=new SalesApprovalHistory();h.setInitiation(saved);h.setFromStatus(from);h.setToStatus(target);h.setComment(comment);var auth=SecurityContextHolder.getContext().getAuthentication();h.setOperatedBy(auth==null?"system":auth.getName());history.save(h);
  if(target==SalesInitiationStatus.PROCUREMENT_PENDING&&procurement.findByInitiation_Id(id).isEmpty()){var p=new ProcurementProject();p.setInitiation(saved);p.setProjectNo("PP-"+java.time.Year.now().getValue()+"-"+UUID.randomUUID().toString().substring(0,8).toUpperCase());p.setQuotationDeadline(LocalDate.now().plusDays(7));procurement.save(p);}
  return saved;
 }
 public SalesInitiation get(Long id){return initiations.findById(id).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"销售立项不存在"));}
 public SalesInitiation requireDraft(Long id){var item=get(id);if(item.getStatus()!=SalesInitiationStatus.DRAFT)throw new ResponseStatusException(HttpStatus.CONFLICT,"只有草稿状态允许修改需求明细");return item;}
 public List<SalesInitiation> list(){return initiations.findAll();}
}
