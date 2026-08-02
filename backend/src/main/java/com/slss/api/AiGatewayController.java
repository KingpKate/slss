package com.slss.api;

import com.slss.service.AiGatewayService;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/ai")
public class AiGatewayController {
  private final AiGatewayService gateway;
  public AiGatewayController(AiGatewayService gateway) { this.gateway = gateway; }

  public record AnalyzeRequest(@NotBlank String faultDescription, String machineConfig, String logs) {}

  @PostMapping("/analyze")
  @PreAuthorize("isAuthenticated()")
  public Map<String, Object> analyze(@Valid @RequestBody AnalyzeRequest request) {
    return gateway.analyze(request.faultDescription(), request.machineConfig(), request.logs());
  }

  @PostMapping("/test")
  @PreAuthorize("hasAuthority('PERM_MANAGE_SYSTEM')")
  public Map<String, String> test(@RequestBody(required = false) Map<String, String> override) {
    return Map.of("message", gateway.test(override == null ? Map.of() : override));
  }
}
