package com.slss.api;

import com.zaxxer.hikari.HikariDataSource;
import java.lang.management.ManagementFactory;
import java.lang.management.MemoryMXBean;
import java.lang.management.OperatingSystemMXBean;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import javax.sql.DataSource;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Real, read-only operational status used by the system administration console. */
@RestController
@RequestMapping("/api/v1/system")
public class SystemStatusController {
  private final DataSource dataSource;
  private final StringRedisTemplate redis;
  private final String version;
  private final Instant startedAt = Instant.now();

  public SystemStatusController(DataSource dataSource, StringRedisTemplate redis, @Value("${slss.version:2.1.0}") String version) {
    this.dataSource = dataSource;
    this.redis = redis;
    this.version = version;
  }

  @GetMapping("/status")
  @PreAuthorize("hasAuthority('PERM_MANAGE_SYSTEM')")
  public Map<String, Object> status() {
    var result = new LinkedHashMap<String, Object>();
    result.put("timestamp", Instant.now());
    result.put("version", version);
    result.put("uptimeSeconds", Duration.between(startedAt, Instant.now()).toSeconds());
    result.put("jvm", jvm());
    result.put("database", database());
    result.put("redis", redis());
    return result;
  }

  private Map<String, Object> jvm() {
    var memory = ManagementFactory.getMemoryMXBean();
    var os = ManagementFactory.getOperatingSystemMXBean();
    var data = new LinkedHashMap<String, Object>();
    data.put("heapUsedBytes", memory.getHeapMemoryUsage().getUsed());
    data.put("heapMaxBytes", memory.getHeapMemoryUsage().getMax());
    data.put("memoryUsagePercent", percent(memory.getHeapMemoryUsage().getUsed(), memory.getHeapMemoryUsage().getMax()));
    data.put("availableProcessors", os.getAvailableProcessors());
    double load = os.getSystemLoadAverage();
    data.put("systemLoadAverage", load < 0 ? null : round(load));
    data.put("javaVersion", System.getProperty("java.version"));
    return data;
  }

  private Map<String, Object> database() {
    var data = new LinkedHashMap<String, Object>();
    long started = System.nanoTime();
    try (var connection = dataSource.getConnection()) {
      boolean valid = connection.isValid(2);
      data.put("status", valid ? "connected" : "degraded");
      data.put("latencyMs", (System.nanoTime() - started) / 1_000_000L);
      data.put("product", connection.getMetaData().getDatabaseProductName());
      data.put("url", maskUrl(connection.getMetaData().getURL()));
      if (dataSource instanceof HikariDataSource hikari) {
        var pool = hikari.getHikariPoolMXBean();
        if (pool != null) {
          data.put("activeConnections", pool.getActiveConnections());
          data.put("idleConnections", pool.getIdleConnections());
          data.put("totalConnections", pool.getTotalConnections());
          data.put("maxPoolSize", hikari.getMaximumPoolSize());
        }
      }
    } catch (Exception ex) {
      data.put("status", "unavailable");
      data.put("latencyMs", (System.nanoTime() - started) / 1_000_000L);
      // Do not expose JDBC URLs, credentials or driver internals to the admin UI.
      data.put("error", "数据库连接不可用");
    }
    return data;
  }

  private Map<String, Object> redis() {
    var data = new LinkedHashMap<String, Object>();
    long started = System.nanoTime();
    if (redis == null || redis.getConnectionFactory() == null) {
      data.put("status", "disabled");
      data.put("latencyMs", 0L);
      return data;
    }
    try (var connection = redis.getConnectionFactory().getConnection()) {
      String pong = connection.ping();
      data.put("status", "PONG".equalsIgnoreCase(pong) ? "connected" : "degraded");
      data.put("latencyMs", (System.nanoTime() - started) / 1_000_000L);
      data.put("endpoint", "configured");
    } catch (Exception ex) {
      data.put("status", "unavailable");
      data.put("latencyMs", (System.nanoTime() - started) / 1_000_000L);
      data.put("error", "Redis 连接不可用");
    }
    return data;
  }

  private static double percent(long used, long max) {
    return max <= 0 ? 0 : round(used * 100.0 / max);
  }
  private static double round(double value) { return Math.round(value * 10.0) / 10.0; }
  private static String maskUrl(String url) {
    if (url == null) return "";
    return url.replaceAll("(?i)(password=)[^&]*", "$1***");
  }
}
