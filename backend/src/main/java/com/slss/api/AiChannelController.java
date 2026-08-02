package com.slss.api;

import com.slss.service.AiChannelService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/settings/ai/channels")
@PreAuthorize("hasAuthority('PERM_MANAGE_SYSTEM')")
public class AiChannelController {
  private final AiChannelService service;
  public AiChannelController(AiChannelService service) { this.service = service; }
  @GetMapping public Object list() { return service.list(); }
  @PostMapping public Object create(@RequestBody Map<String,Object> body) { return service.create(body); }
  @PutMapping("/{id}") public Object update(@PathVariable long id, @RequestBody Map<String,Object> body) { return service.update(id, body); }
  @DeleteMapping("/{id}") public void delete(@PathVariable long id) { service.delete(id); }
  @PostMapping("/{id}/test") public Object test(@PathVariable long id) { return service.test(id); }
  @GetMapping("/{id}/models") public Object models(@PathVariable long id) { return service.models(id); }
}
