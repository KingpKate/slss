package com.slss.api;

import com.slss.domain.ScanTable;
import com.slss.domain.ScanTableRow;
import com.slss.domain.ScanTableValue;
import com.slss.domain.ScanTemplate;
import com.slss.domain.ScanTemplateField;
import com.slss.domain.CustomerTenant;
import com.slss.repository.ScanTableRepository;
import com.slss.repository.ScanTableValueRepository;
import com.slss.repository.ScanTemplateFieldRepository;
import com.slss.repository.ScanTemplateRepository;
import com.slss.service.AuditService;
import com.slss.service.TenantScopeService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Answers;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Focused production scan-table tests.  These intentionally exercise the
 * controller contract without requiring Docker/MySQL, so they run in the
 * normal unit-test phase as well as in CI environments without Docker.
 */
class ScanTableControllerTest {
  private ScanTableRepository tables;
  private ScanTemplateRepository templates;
  private ScanTableValueRepository scanValues;
  private ScanTableController controller;
  private ScanTable table;
  private ScanTableRow row;
  private ScanTemplate template;

  @BeforeEach
  void setUp() {
    tables = mock(ScanTableRepository.class);
    templates = mock(ScanTemplateRepository.class);
    scanValues = mock(ScanTableValueRepository.class);
    ScanTemplateFieldRepository fields = mock(ScanTemplateFieldRepository.class);
    AuditService audit = mock(AuditService.class, Answers.RETURNS_DEFAULTS);
    TenantScopeService tenantScope = mock(TenantScopeService.class);
    doNothing().when(tenantScope).requireAccess(any());
    when(tenantScope.canAccess(any())).thenReturn(true);

    controller = new ScanTableController(templates, tables, scanValues, fields, audit, tenantScope);
    template = new ScanTemplate();
    template.setCustomerName("测试客户");
    template.setModel("M-100");

    var machine = field("machine_sn", "整机 SN", "SN", true, 0);
    var cpu = field("cpu_sn", "CPU SN", "SN", true, 1);
    template.getFields().addAll(List.of(machine, cpu));

    table = new ScanTable();
    ReflectionTestUtils.setField(table, "id", 1L);
    table.setTemplate(template);
    table.setCustomerName(template.getCustomerName());
    table.setModel(template.getModel());
    table.setQuantity(1);
    row = new ScanTableRow();
    ReflectionTestUtils.setField(row, "id", 11L);
    row.setScanTable(table);
    row.setRowNumber(1);
    table.getRows().add(row);
    when(tables.findById(1L)).thenReturn(Optional.of(table));
    when(tables.save(any(ScanTable.class))).thenAnswer(inv -> inv.getArgument(0));

    SecurityContextHolder.getContext().setAuthentication(
        new TestingAuthenticationToken("001", "n/a", "PERM_OPERATE_SCAN"));
  }

  @AfterEach
  void clearSecurity() { SecurityContextHolder.clearContext(); }

  @Test
  void saveRowPersistsValueAndOperatorForSnField() {
    var saved = controller.saveRow(1L, 1, List.of(
        new ScanTableController.Value("machine_sn", "MACHINE-001")));

    assertEquals("MACHINE-001", value(row, "machine_sn").getFieldValue());
    assertEquals("001", value(row, "machine_sn").getOperatorNo());
    assertNotNull(value(row, "machine_sn").getScannedAt());
    assertEquals("M-100", saved.get("model"));
  }

  @Test
  void completeRowRejectsMissingRequiredSn() {
    var error = assertThrows(ResponseStatusException.class,
        () -> controller.completeRow(1L, 1));

    assertEquals(403, error.getStatusCode().value());
    assertTrue(error.getReason().contains("必填项"));
    assertEquals("OPEN", row.getStatus());
  }

  @Test
  void completeRowMarksRowAndTableWhenRequiredValuesExist() {
    addValue("machine_sn", "MACHINE-001", "001");
    addValue("cpu_sn", "CPU-001", "001");

    var result = controller.completeRow(1L, 1);

    assertEquals("COMPLETED", row.getStatus());
    assertEquals("COMPLETED", table.getStatus());
    assertEquals("001", row.getCompletedBy());
    assertNotNull(row.getCompletedAt());
    assertEquals("COMPLETED", result.get("status"));
  }

  @Test
  void saveRowRejectsSerialAlreadyBoundToAnotherDevice() {
    var existingTable = new ScanTable();
    existingTable.setTemplate(template);
    existingTable.setModel("M-100");
    var existingRow = new ScanTableRow();
    ReflectionTestUtils.setField(existingRow, "id", 22L);
    existingRow.setScanTable(existingTable);
    existingRow.setRowNumber(1);
    existingRow.setMachineSn("MACHINE-OLD");
    existingTable.getRows().add(existingRow);
    var existing = new ScanTableValue();
    existing.setRow(existingRow);
    existing.setFieldKey("cpu_sn");
    existing.setFieldValue("CPU-DUP");
    existingRow.getValues().add(existing);

    // The controller's repository lookup is tenant-scoped. The fixture uses
    // legacy null-tenant data, which is covered by the dedicated query.
    var values = (ScanTableValueRepository) ReflectionTestUtils.getField(controller, "values");
    when(values.findByValueWithoutTenant("CPU-DUP")).thenReturn(List.of(existing));

    var error = assertThrows(ResponseStatusException.class, () ->
        controller.saveRow(1L, 1, List.of(new ScanTableController.Value("cpu_sn", "CPU-DUP"))));

    assertEquals(409, error.getStatusCode().value());
    assertTrue(error.getReason().contains("MACHINE-OLD"));
    assertTrue(error.getReason().contains("CPU SN"));
    verify(tables, never()).save(any(ScanTable.class));
  }

  @Test
  void saveRowRejectsSnAlreadyUsedByAnotherDevice() {
    var otherTable = new ScanTable();
    otherTable.setTemplate(template);
    otherTable.setModel("M-100");
    var otherRow = new ScanTableRow();
    ReflectionTestUtils.setField(otherRow, "id", 22L);
    otherRow.setScanTable(otherTable);
    otherRow.setMachineSn("MACHINE-OTHER");
    var otherValue = new ScanTableValue();
    otherValue.setRow(otherRow);
    otherValue.setFieldKey("cpu_sn");
    otherValue.setFieldValue("CPU-USED");
    otherTable.getRows().add(otherRow);
    when(scanValues.findByValueWithoutTenant("CPU-USED")).thenReturn(List.of(otherValue));

    var error = assertThrows(ResponseStatusException.class, () ->
        controller.saveRow(1L, 1, List.of(new ScanTableController.Value("cpu_sn", "CPU-USED"))));

    assertEquals(409, error.getStatusCode().value());
    assertTrue(error.getReason().contains("MACHINE-OTHER"));
    assertTrue(error.getReason().contains("CPU SN"));
  }

  @Test
  void completedRowCannotBeEditedWithoutForcePermission() {
    row.setStatus("COMPLETED");

    var error = assertThrows(ResponseStatusException.class, () ->
        controller.saveRow(1L, 1, List.of(new ScanTableController.Value("cpu_sn", "CPU-NEW"))));

    assertEquals(403, error.getStatusCode().value());
    assertTrue(error.getReason().contains("PERM_FORCE_EDIT_COMPLETED_SCAN"));
  }

  @Test
  void listTemplatesOnlyReturnsTenantVisibleTemplates() {
    var visible = new ScanTemplate();
    visible.setCustomerName("客户 A"); visible.setModel("A-1");
    var hidden = new ScanTemplate();
    hidden.setCustomerName("客户 B"); hidden.setModel("B-1");
    visible.setTenant(new CustomerTenant());
    hidden.setTenant(new CustomerTenant());
    when(templates.findByActiveTrueOrderByCustomerNameAscModelAsc()).thenReturn(List.of(visible, hidden));
    // TenantScopeService is mocked in setUp: only the visible fixture is allowed.
    // Replace the default broad matcher with deterministic per-object behavior.
    var scope = org.mockito.Mockito.mock(TenantScopeService.class);
    when(scope.canAccess(visible.getTenant())).thenReturn(true);
    when(scope.canAccess(hidden.getTenant())).thenReturn(false);
    // A fresh controller is used to keep the test independent from the common fixture.
    controller = new ScanTableController(templates, tables, scanValues,
        mock(ScanTemplateFieldRepository.class), mock(AuditService.class), scope);

    var result = controller.listTemplates();

    assertEquals(1, result.size());
    assertEquals("客户 A", result.get(0).get("customerName"));
  }

  private static ScanTemplateField field(String key, String label, String type, boolean required, int order) {
    var field = new ScanTemplateField();
    field.setFieldKey(key); field.setFieldLabel(label); field.setFieldType(type);
    field.setRequired(required); field.setSortOrder(order);
    return field;
  }

  private void addValue(String key, String value, String operator) {
    var v = new ScanTableValue(); v.setRow(row); v.setFieldKey(key); v.setFieldValue(value); v.setOperatorNo(operator);
    row.getValues().add(v);
  }

  private static ScanTableValue value(ScanTableRow row, String key) {
    return row.getValues().stream().filter(v -> key.equals(v.getFieldKey())).findFirst().orElseThrow();
  }
}
