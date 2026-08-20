package com.slss;

import com.slss.domain.Asset;
import com.slss.repository.AssetRepository;
import com.slss.repository.AssetComponentRepository;
import com.slss.repository.LifecycleEventRepository;
import com.slss.repository.OrderStatusHistoryRepository;
import com.slss.service.ProductionBatchService;
import com.slss.service.RepairOrderService;
import com.slss.api.ProductionImportController;
import com.slss.domain.RepairOrder;
import com.slss.domain.OrderStatus;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIf;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.test.context.support.WithMockUser;

import java.io.ByteArrayOutputStream;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
@Testcontainers
@EnabledIf("dockerAvailable")
@WithMockUser(username = "integration-admin", authorities = "PERM_MANAGE_SYSTEM")
class IntegrationTest {
  static boolean dockerAvailable() { try { return org.testcontainers.DockerClientFactory.instance().isDockerAvailable(); } catch (Throwable ignored) { return false; } }
  @Container
  static final MySQLContainer<?> MYSQL = new MySQLContainer<>("mysql:8.0.36")
      .withDatabaseName("slss")
      .withUsername("slss")
      .withPassword("slss-test-password");

  @DynamicPropertySource
  static void databaseProperties(DynamicPropertyRegistry registry) {
    registry.add("spring.datasource.url", MYSQL::getJdbcUrl);
    registry.add("spring.datasource.username", MYSQL::getUsername);
    registry.add("spring.datasource.password", MYSQL::getPassword);
    registry.add("spring.flyway.enabled", () -> true);
    registry.add("spring.jpa.hibernate.ddl-auto", () -> "validate");
    registry.add("slss.security.jwt-secret", () -> "integration-test-secret-at-least-32-bytes");
  }

  @Autowired ProductionBatchService batches;
  @Autowired AssetRepository assets;
  @Autowired AssetComponentRepository components;
  @Autowired ProductionImportController imports;
  @Autowired RepairOrderService repairOrders;
  @Autowired OrderStatusHistoryRepository statusHistory;
  @Autowired LifecycleEventRepository lifecycle;

  @Test
  void flywayCreatesCoreSchemaAndBatchCommitPersistsAsset() {
    var batch = batches.create("IT-BATCH-001");
    var asset = new Asset();
    asset.setMachineSn("IT-SN-001");
    asset.setModel("TEST-SERVER");
    var committed = batches.commit(batch.getId(), List.of(asset));

    assertEquals("COMMITTED", committed.getStatus());
    assertTrue(assets.findByMachineSnIgnoreCase("IT-SN-001").isPresent());
  }

  @Test
  @WithMockUser(username = "integration-admin", authorities = {"PERM_MANAGE_SYSTEM", "PERM_MANAGE_PRODUCTION"})
  void excelImportPersistsValidAssetAndComponentAndReportsInvalidRows() throws Exception {
    byte[] data;
    try (var workbook = new XSSFWorkbook(); var out = new ByteArrayOutputStream()) {
      var sheet = workbook.createSheet("assets");
      var header = sheet.createRow(0);
      header.createCell(0).setCellValue("机器SN");
      header.createCell(1).setCellValue("合同号");
      header.createCell(2).setCellValue("型号");
      header.createCell(3).setCellValue("组件SN");
      header.createCell(4).setCellValue("组件型号");
      var valid = sheet.createRow(1);
      valid.createCell(0).setCellValue("IT-IMPORT-SN-001");
      valid.createCell(1).setCellValue("CONTRACT-001");
      valid.createCell(2).setCellValue("SLSS-SERVER");
      valid.createCell(3).setCellValue("IT-MB-SN-001");
      valid.createCell(4).setCellValue("MAINBOARD-X");
      var duplicate = sheet.createRow(2);
      duplicate.createCell(0).setCellValue("IT-IMPORT-SN-001");
      duplicate.createCell(3).setCellValue("IT-MB-SN-002");
      var missing = sheet.createRow(3);
      missing.createCell(1).setCellValue("CONTRACT-002");
      workbook.write(out);
      data = out.toByteArray();
    }

    var file = new MockMultipartFile(
        "file", "production.xlsx",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", data);
    var result = imports.importExcel("IT-IMPORT-BATCH-001", file);

    assertEquals(3, result.total());
    assertEquals(1, result.success());
    assertEquals(2, result.failed());
    var asset = assets.findByMachineSnIgnoreCase("IT-IMPORT-SN-001").orElseThrow();
    var savedComponents = components.findByAssetIdOrderById(asset.getId());
    assertEquals(1, savedComponents.size());
    assertEquals("IT-MB-SN-001", savedComponents.get(0).getSerialNo());
    assertTrue(result.rows().stream().anyMatch(r -> !r.success() && r.message().contains("重复")));
    assertTrue(result.rows().stream().anyMatch(r -> !r.success() && r.message().contains("为空")));
  }

  @Test
  void serviceOrderCreationAndTransitionWriteHistoryAndAssetLifecycle() {
    var batch = batches.create("IT-SERVICE-BATCH-001");
    var asset = new Asset();
    asset.setMachineSn("IT-SERVICE-SN-001");
    batches.commit(batch.getId(), List.of(asset));
    var order = new RepairOrder();
    order.setOrderNumber("IT-ORDER-001");
    order.setCustomerName("集成测试客户");
    order.setFaultDescription("无法开机");
    order.setMachineSn("IT-SERVICE-SN-001");
    order = repairOrders.create(order);
    repairOrders.assign(order.getId(), 1L, java.time.Duration.ofHours(72), "集成测试分配");
    repairOrders.transition(order.getId(), OrderStatus.ASSIGNED, "指派工程师");

    var history = statusHistory.findByOrderIdOrderByCreatedAtAsc(order.getId());
    assertEquals(2, history.size());
    assertEquals(OrderStatus.PENDING, history.get(0).getToStatus());
    assertEquals(OrderStatus.ASSIGNED, history.get(1).getToStatus());
    var persistedAsset = assets.findByMachineSnIgnoreCase("IT-SERVICE-SN-001").orElseThrow();
    var events = lifecycle.findByAssetIdOrderByOccurredAtAsc(persistedAsset.getId());
    assertEquals(3, events.size());
    assertTrue(events.stream().anyMatch(e -> "SERVICE_ORDER_CREATED".equals(e.getEventType())));
    assertTrue(events.stream().anyMatch(e -> "SERVICE_STATUS_CHANGED".equals(e.getEventType())));
  }
}
