package com.slss.api;

import java.time.OffsetDateTime;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import javax.sql.DataSource;
import java.sql.Connection;
import org.springframework.beans.factory.annotation.Autowired;

@RestController
@RequestMapping("/api/v1")
public class HealthController {
  private static final Logger log = LoggerFactory.getLogger(HealthController.class);
  private final DataSource dataSource;
  public HealthController() { this.dataSource = null; }
  @Autowired
  public HealthController(DataSource dataSource) { this.dataSource = dataSource; }
  @GetMapping("/health")
  public Map<String, Object> health() {
    if (dataSource == null) return Map.of("status", "ok", "database", "unknown", "service", "slss-backend", "version", "2.1.0", "timestamp", OffsetDateTime.now());
    try (Connection connection = dataSource.getConnection()) {
      boolean valid = connection.isValid(2);
      return Map.of("status", valid ? "ok" : "degraded", "database", valid ? "ok" : "unavailable",
          "service", "slss-backend", "version", "2.1.0", "timestamp", OffsetDateTime.now());
    } catch (Exception ex) {
      log.warn("数据库健康检查失败", ex);
      return Map.of("status", "degraded", "database", "unavailable", "service", "slss-backend", "version", "2.1.0",
          "error", "数据库连接失败", "timestamp", OffsetDateTime.now());
    }
  }
}
