package com.slss.api;
import com.slss.domain.*; import com.slss.service.ProductionBatchService; import com.slss.service.AuditService; import com.slss.repository.*; import org.apache.poi.ss.usermodel.*; import org.springframework.http.HttpStatus; import org.springframework.http.MediaType; import org.springframework.transaction.annotation.Transactional; import org.springframework.web.bind.annotation.*; import org.springframework.web.multipart.MultipartFile; import org.springframework.web.server.ResponseStatusException; import java.io.*; import java.util.*; import org.springframework.security.access.prepost.PreAuthorize; import java.security.Principal;
@RestController @RequestMapping("/api/v1/production/imports") public class ProductionImportController {
 final ProductionBatchService batches; final AssetRepository assets; final AssetComponentRepository components; final LifecycleEventRepository lifecycle; final AuditService audit; public ProductionImportController(ProductionBatchService b,AssetRepository a,AssetComponentRepository c,LifecycleEventRepository l,AuditService audit){batches=b;assets=a;components=c;lifecycle=l;this.audit=audit;}
 public record RowResult(int row,boolean success,String machineSn,String message){} public record ImportResult(String batchName,int total,int success,int failed,List<RowResult> rows){}
 record ParsedRow(int row,String machineSn,String contractNo,String model,String componentSn,String componentModel){}
 private static final long MAX_IMPORT_SIZE=10L*1024*1024; private static final Set<String> ALLOWED_CONTENT_TYPES=Set.of("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","application/vnd.ms-excel");
 @PostMapping(consumes=MediaType.MULTIPART_FORM_DATA_VALUE) @PreAuthorize("hasAuthority('PERM_MANAGE_PRODUCTION')") @Transactional public ImportResult importExcel(@RequestParam String batchName,@RequestPart MultipartFile file,Principal principal)throws IOException{
  if(batchName==null||batchName.isBlank())throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"批次名称不能为空");
  if(file==null||file.isEmpty())throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"导入文件不能为空");
  if(file.getSize()>MAX_IMPORT_SIZE)throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE,"文件超过 10MB 限制");
  if(file.getContentType()==null||!ALLOWED_CONTENT_TYPES.contains(file.getContentType()))throw new ResponseStatusException(HttpStatus.UNSUPPORTED_MEDIA_TYPE,"仅允许 xlsx/xls 文件");
  audit.record(principal==null?"system":principal.getName(),"PRODUCTION_IMPORT_START","PRODUCTION_BATCH",batchName,"开始导入文件："+file.getOriginalFilename(),null,true);
  validateMagic(file);
  var parsed=new ArrayList<ParsedRow>();var results=new ArrayList<RowResult>();
  try(InputStream in=file.getInputStream();Workbook wb=WorkbookFactory.create(in)){if(wb.getNumberOfSheets()==0)throw new IllegalArgumentException("Excel 不包含工作表");var sheet=wb.getSheetAt(0);for(int i=1;i<=sheet.getLastRowNum();i++){var r=sheet.getRow(i);if(r==null)continue;parsed.add(new ParsedRow(i+1,text(r.getCell(0)),text(r.getCell(1)),text(r.getCell(2)),text(r.getCell(3)),text(r.getCell(4))));}}
  var seenMachines=new HashSet<String>();var seenComponents=new HashSet<String>();var valid=new ArrayList<ParsedRow>();
  for(var row:parsed){String error=null;var machineKey=row.machineSn().toUpperCase(Locale.ROOT);var componentKey=row.componentSn().toUpperCase(Locale.ROOT);
   if(row.machineSn().isBlank())error="机器 SN 为空";
   else if(!seenMachines.add(machineKey))error="Excel 内机器 SN 重复";
   else if(assets.findByMachineSnIgnoreCase(row.machineSn()).isPresent())error="机器 SN 已存在";
   else if(!row.componentSn().isBlank()&&!seenComponents.add(componentKey))error="Excel 内组件 SN 重复";
   else if(!row.componentSn().isBlank()&&components.existsBySerialNo(row.componentSn()))error="组件 SN 已存在";
   if(error==null)valid.add(row);else results.add(new RowResult(row.row(),false,row.machineSn(),error));
  }
  if(parsed.isEmpty())throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Excel 不包含有效数据行");
  var batch=batches.create(batchName);
  for(var row:valid){var a=new Asset();a.setMachineSn(row.machineSn());a.setContractNo(row.contractNo());a.setModel(row.model());a.setBatch(batch);a=assets.save(a);if(!row.componentSn().isBlank()){var c=new AssetComponent();c.setAsset(a);c.setComponentType("MOTHERBOARD");c.setModel(row.componentModel());c.setSerialNo(row.componentSn());components.save(c);}var event=new LifecycleEvent();event.setAsset(a);event.setEventType("PRODUCTION_REGISTERED");event.setDetails("通过生产批次 "+batchName+" 入库");lifecycle.save(event);results.add(new RowResult(row.row(),true,row.machineSn(),"导入成功"));}
  batch.setStatus("COMMITTED");results.sort(Comparator.comparingInt(RowResult::row));audit.record(principal==null?"system":principal.getName(),"PRODUCTION_IMPORT_COMPLETED","PRODUCTION_BATCH",batchName,"导入完成：成功 "+valid.size()+"，失败 "+(results.size()-valid.size()),null,true);return new ImportResult(batchName,results.size(),valid.size(),results.size()-valid.size(),results);
 }
 private static void validateMagic(MultipartFile file)throws IOException{try(InputStream in=file.getInputStream()){byte[] h=in.readNBytes(8);boolean xlsx=h.length>=4&&h[0]==(byte)0x50&&h[1]==(byte)0x4b;boolean xls=h.length>=8&&(h[0]&0xff)==0xd0&&(h[1]&0xff)==0xcf&&(h[2]&0xff)==0x11&&(h[3]&0xff)==0xe0;if(!xlsx&&!xls)throw new ResponseStatusException(HttpStatus.UNSUPPORTED_MEDIA_TYPE,"文件内容不是有效的 Excel 文件");}}
 public ImportResult importExcel(String batchName,MultipartFile file)throws IOException{return importExcel(batchName,file,null);}
 private static String text(Cell c){if(c==null)return "";return new DataFormatter().formatCellValue(c).trim();}
}
