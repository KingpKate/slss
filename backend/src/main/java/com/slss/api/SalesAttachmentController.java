package com.slss.api;
import com.slss.domain.SalesAttachment; import com.slss.repository.SalesAttachmentRepository; import com.slss.service.SalesInitiationService; import jakarta.transaction.Transactional; import org.springframework.beans.factory.annotation.Value; import org.springframework.core.io.*; import org.springframework.http.*; import org.springframework.security.access.prepost.PreAuthorize; import org.springframework.security.core.context.SecurityContextHolder; import org.springframework.web.bind.annotation.*; import org.springframework.web.multipart.MultipartFile; import org.springframework.web.server.ResponseStatusException; import java.io.*; import java.nio.file.*; import java.time.Instant; import java.util.*;
@RestController @RequestMapping("/api/v1/sales-initiations/{initiationId}/attachments") @PreAuthorize("hasAnyAuthority('PERM_MANAGE_SALES','PERM_MANAGE_PROCUREMENT')")
public class SalesAttachmentController {
 private final SalesAttachmentRepository repository; private final SalesInitiationService sales; private final Path root; private final long maxBytes;
 public SalesAttachmentController(SalesAttachmentRepository r,SalesInitiationService s,@Value("${slss.attachments.directory:${java.io.tmpdir}/slss-attachments}") String directory,@Value("${slss.attachments.max-bytes:20971520}") long maxBytes){repository=r;sales=s;root=Paths.get(directory).toAbsolutePath().normalize();this.maxBytes=maxBytes;}
 public record Response(Long id,String fileName,String contentType,long fileSize,String uploadedBy,Instant createdAt){}
 private Response dto(SalesAttachment x){return new Response(x.getId(),x.getFileName(),x.getContentType(),x.getFileSize(),x.getUploadedBy(),x.getCreatedAt());}
 @GetMapping public List<Response> list(@PathVariable Long initiationId){sales.get(initiationId);return repository.findByInitiation_IdOrderByCreatedAtDesc(initiationId).stream().map(this::dto).toList();}
 @PostMapping(consumes=MediaType.MULTIPART_FORM_DATA_VALUE) @Transactional public Response upload(@PathVariable Long initiationId,@RequestPart MultipartFile file)throws IOException{
  if(file.isEmpty())throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"附件不能为空");if(file.getSize()>maxBytes)throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE,"附件超过大小限制");
  String original=Optional.ofNullable(file.getOriginalFilename()).orElse("attachment").replaceAll("[\\\\/\\r\\n]","_");String key=UUID.randomUUID().toString();
  Files.createDirectories(root);Path target=root.resolve(key).normalize();if(!target.getParent().equals(root))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"非法附件路径");
  try(InputStream in=file.getInputStream()){Files.copy(in,target,StandardCopyOption.REPLACE_EXISTING);}
  var x=new SalesAttachment();x.setInitiation(sales.get(initiationId));x.setFileName(original);x.setStorageKey(key);x.setContentType(file.getContentType());x.setFileSize(file.getSize());var auth=SecurityContextHolder.getContext().getAuthentication();x.setUploadedBy(auth==null?"system":auth.getName());return dto(repository.save(x));
 }
 @GetMapping("/{id}/content") public ResponseEntity<Resource> download(@PathVariable Long initiationId,@PathVariable Long id)throws IOException{
  var x=repository.findById(id).filter(a->a.getInitiationId().equals(initiationId)).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"附件不存在"));Path path=root.resolve(x.getStorageKey()).normalize();if(!path.getParent().equals(root)||!Files.isRegularFile(path))throw new ResponseStatusException(HttpStatus.NOT_FOUND,"附件文件不存在");
  return ResponseEntity.ok().contentType(MediaType.parseMediaType(x.getContentType()==null?"application/octet-stream":x.getContentType())).header(HttpHeaders.CONTENT_DISPOSITION,ContentDisposition.attachment().filename(x.getFileName(),java.nio.charset.StandardCharsets.UTF_8).build().toString()).contentLength(x.getFileSize()).body(new FileSystemResource(path));
 }
}
