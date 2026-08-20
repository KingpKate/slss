package com.slss.service;

import com.slss.domain.PerformanceDepartment;
import com.slss.repository.PerformanceDepartmentRepository;
import com.slss.repository.UserRepository;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.ss.util.CellRangeAddress;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.InputStream;
import java.io.File;
import java.nio.file.Files;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Converts the supplied supervisor workbook into validated formal templates. */
@Service
public class PerformanceExcelImportService {
  private static final Pattern WEIGHT = Pattern.compile("【\\s*(\\d+(?:\\.\\d+)?)%\\s*】");
  private static final Set<String> SKIP_SHEETS = Set.of("评定标准");
  private static final Set<String> MANAGER_NAMES = Set.of("区总","崔总","代总","梅总","梅姐","王岩","李占霞","戴婉珍","占霞","自己列举");
  private static final Map<String,String> DEPARTMENTS = Map.ofEntries(
    Map.entry("销售部","SALES"), Map.entry("市场部","MARKET"), Map.entry("商务部","BUSINESS"),
    Map.entry("结构部","STRUCTURE"), Map.entry("电子电路部","ELECTRONICS"), Map.entry("产品部","PRODUCT"),
    Map.entry("解决方案部","SOLUTION"), Map.entry("采购部","PROCUREMENT"), Map.entry("生产部","PRODUCTION"),
    Map.entry("人事部","HR"), Map.entry("售后部","AFTER_SALES"), Map.entry("测试部","TEST"),
    Map.entry("财务部","FINANCE"), Map.entry("品质部","QUALITY"), Map.entry("仓储部","WAREHOUSE"));
  private final PerformanceTemplateService templates;
  private final PerformanceDepartmentRepository departments;
  private final UserRepository users;
  private final com.slss.repository.PerformanceImportPreviewRepository previews;

  public PerformanceExcelImportService(PerformanceTemplateService templates, PerformanceDepartmentRepository departments, UserRepository users, com.slss.repository.PerformanceImportPreviewRepository previews) {
    this.templates = templates; this.departments = departments; this.users = users; this.previews = previews;
  }

  public record ImportReport(int imported, List<String> sheets, List<String> skipped, List<String> errors) {}
  public record PreviewReport(String token, int templates, List<String> sheets, List<String> duplicates, List<String> errors) {}

  /** Parses and validates a workbook without creating or changing any database row. */
  @Transactional
  public PreviewReport previewWorkbook(MultipartFile file) {
    validateFile(file);
    var sheets=new ArrayList<String>(); var duplicates=new ArrayList<String>(); var errors=new ArrayList<String>(); int valid=0;
    try (InputStream in=file.getInputStream(); Workbook workbook=WorkbookFactory.create(in)) {
      for(int i=0;i<workbook.getNumberOfSheets();i++) {
        Sheet sheet=workbook.getSheetAt(i); if(SKIP_SHEETS.contains(sheet.getSheetName().trim())) continue;
        try { var input=parseSheet(sheet); valid++; sheets.add(sheet.getSheetName()); int version=input.templateVersion()==null?1:input.templateVersion(); if(templates.templateExists(input.departmentId(),input.templateName(),version)) duplicates.add(input.templateName()+"@v"+version); }
        catch(RuntimeException ex){ errors.add(sheet.getSheetName()+": "+message(ex)); }
      }
    } catch(Exception ex){ throw bad("PERFORMANCE_EXCEL_INVALID","Excel 文件无法读取: "+message(ex)); }
    if (!errors.isEmpty() || valid == 0) return new PreviewReport(null,valid,sheets,duplicates,errors);
    try {
      var bytes=file.getBytes();
      var staged=previews.save(new com.slss.domain.PerformanceImportPreview(bytes,
          Objects.toString(file.getOriginalFilename(),"workbook.xlsx"), Instant.now().plusSeconds(1800)));
      return new PreviewReport(staged.getToken(),valid,sheets,duplicates,errors);
    } catch (Exception ex) { throw bad("PERFORMANCE_IMPORT_PREVIEW_STORE","导入预览暂存失败: "+message(ex)); }
  }

  @Transactional
  public ImportReport confirmPreview(String token, boolean skipDuplicates) {
    if (token == null || token.isBlank()) throw bad("PERFORMANCE_IMPORT_PREVIEW_INVALID","预览令牌不能为空");
    var staged=previews.findById(token).orElseThrow(() -> bad("PERFORMANCE_IMPORT_PREVIEW_NOT_FOUND","导入预览不存在或已过期"));
    if (!"PENDING".equals(staged.getStatus()) || staged.getExpiresAt().isBefore(Instant.now())) throw bad("PERFORMANCE_IMPORT_PREVIEW_EXPIRED","导入预览已过期或已确认");
    var result=importWorkbook(new ByteMultipartFile(staged.getWorkbookData(), staged.getOriginalFilename()), skipDuplicates);
    staged.setStatus("CONFIRMED"); previews.save(staged);
    return result;
  }

  private static final class ByteMultipartFile implements MultipartFile {
    private final byte[] data; private final String filename;
    ByteMultipartFile(byte[] data,String filename){this.data=data;this.filename=filename;}
    public String getName(){return "file";} public String getOriginalFilename(){return filename;} public String getContentType(){return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";}
    public boolean isEmpty(){return data.length==0;} public long getSize(){return data.length;} public byte[] getBytes(){return data.clone();} public InputStream getInputStream(){return new java.io.ByteArrayInputStream(data);}
    public void transferTo(File destination) throws java.io.IOException {Files.write(destination.toPath(),data);}
  }

  @Transactional
  public ImportReport importWorkbook(MultipartFile file) { return importWorkbook(file, false); }
  @Transactional
  public ImportReport importWorkbook(MultipartFile file, boolean skipDuplicates) {
    validateFile(file);
    var inputs = new ArrayList<PerformanceTemplateService.TemplateInput>();
    var names = new ArrayList<String>();
    var skipped = new ArrayList<String>();
    var errors = new ArrayList<String>();
    try (InputStream in = file.getInputStream(); Workbook workbook = WorkbookFactory.create(in)) {
      for (int i = 0; i < workbook.getNumberOfSheets(); i++) {
        Sheet sheet = workbook.getSheetAt(i);
        if (SKIP_SHEETS.contains(sheet.getSheetName().trim())) continue;
        try {
          var input = parseSheet(sheet);
          inputs.add(input); names.add(sheet.getSheetName());
        } catch (RuntimeException ex) {
          errors.add(sheet.getSheetName() + ": " + message(ex));
        }
      }
    } catch (Exception ex) {
      throw bad("PERFORMANCE_EXCEL_INVALID", "Excel 文件无法读取: " + message(ex));
    }
    if (!errors.isEmpty()) throw bad("PERFORMANCE_EXCEL_INVALID", String.join("; ", errors));
    if (inputs.isEmpty()) throw bad("PERFORMANCE_EXCEL_EMPTY", "Excel 中没有可导入的正式模板工作表");
    // importTemplate performs duplicate checks and all domain validations inside the same transaction.
    var importedNames = new ArrayList<String>();
    for (var input : inputs) {
      int version = input.templateVersion() == null ? 1 : input.templateVersion();
      if (skipDuplicates && templates.templateExists(input.departmentId(), input.templateName(), version)) { skipped.add(input.templateName()); continue; }
      templates.importTemplate(input); importedNames.add(input.templateName());
    }
    return new ImportReport(importedNames.size(), importedNames, skipped, List.of());
  }

  private PerformanceTemplateService.TemplateInput parseSheet(Sheet sheet) {
    String sheetName = sheet.getSheetName().trim();
    String departmentName = text(sheet, 1, 1);
    if (departmentName.isBlank()) departmentName = sheetName.replaceAll("（.*?）|\\(.*?\\)", "").trim();
    departmentName = normalizeDepartment(departmentName);
    String departmentCode = DEPARTMENTS.get(departmentName);
    if (departmentCode == null) throw new IllegalArgumentException("无法识别部门: " + departmentName);
    departments.findByCodeAndStatus(departmentCode, "ACTIVE").orElseThrow(() -> new IllegalArgumentException("部门未初始化: " + departmentCode));
    var sections = new ArrayList<PerformanceTemplateService.SectionInput>();
    String currentSection = null; BigDecimal currentWeight = null; var items = new ArrayList<PerformanceTemplateService.ItemInput>(); int sectionNo = 0; int itemNo = 0;
    for (int rowNo = 3; rowNo <= sheet.getLastRowNum(); rowNo++) {
      String first = mergedText(sheet, rowNo, 0);
      if (first.contains("合计")) break;
      String standard = mergedText(sheet, rowNo, 2);
      if (standard.isBlank() || standard.contains("员工自评") || standard.startsWith("备注")) continue;
      Matcher weight = WEIGHT.matcher(first);
      if (weight.find() && isMergeStart(sheet, rowNo, 0)) {
        if (currentSection != null) sections.add(new PerformanceTemplateService.SectionInput("S" + (++sectionNo), currentSection, currentWeight, List.copyOf(items)));
        currentSection = first.replaceAll("【.*?】", "").replaceAll("^\\s*", "").trim();
        currentWeight = new BigDecimal(weight.group(1)).divide(BigDecimal.valueOf(100), 6, RoundingMode.HALF_UP);
        items.clear(); itemNo = 0;
      }
      if (currentSection == null) continue;
      BigDecimal max = decimal(mergedText(sheet, rowNo, 5));
      if (max == null || max.signum() <= 0) continue;
      String factor = mergedText(sheet, rowNo, 1);
      if (factor.isBlank()) factor = "指标" + (itemNo + 1);
      var scopes = parseScopes(mergedText(sheet, rowNo, 3), departmentCode);
      items.add(new PerformanceTemplateService.ItemInput("S" + (sectionNo + 1) + "I" + (++itemNo), factor, standard, max, scopes));
    }
    if (currentSection != null) sections.add(new PerformanceTemplateService.SectionInput("S" + (++sectionNo), currentSection, currentWeight, List.copyOf(items)));
    if (sections.isEmpty()) throw new IllegalArgumentException("未发现有效指标行");
    String templateName = "HR".equals(departmentCode) ? "主管绩效评价" : sheetName;
    Long subjectUserId = null;
    Matcher person = Pattern.compile("(?:商务部|商务)\s*[【\\[]([^】\\]]+)[】\\]]").matcher(sheetName);
    if (person.find()) {
      String display = person.group(1).trim();
      subjectUserId = users.findFirstByDisplayNameAndStatus(display, "ACTIVE")
          .or(() -> users.findByUsernameAndStatus(display, "ACTIVE"))
          .map(com.slss.domain.User::getId)
          .orElseThrow(() -> new IllegalArgumentException("工作表人员未匹配到系统用户: " + display));
      templateName = "商务部主管绩效-" + display;
    }
    var fields=new ArrayList<PerformanceTemplateService.FieldInput>();
    var seenFields=new HashSet<String>();
    for(int r=0;r<=Math.min(3,sheet.getLastRowNum());r++) { var headerRow=sheet.getRow(r); if(headerRow==null||headerRow.getLastCellNum()<0) continue; for(int c=0;c<headerRow.getLastCellNum();c++) {
      var header=cell(headerRow,c); if(header.isBlank()) continue;
      String code=null; if(header.contains("当月分数")) code="MONTHLY_SCORE"; else if(header.contains("主管评分")) code="MANAGER_SCORE"; else if(header.contains("自评")) code="SELF_COMMENT"; else if(header.contains("好人好事")) code="GOOD_DEEDS"; else if(header.contains("备注")) code="REMARKS";
      if(code!=null&&seenFields.add(code)) fields.add(new PerformanceTemplateService.FieldInput(code,header,"TEXT",false,fields.size()));
    }}
    return new PerformanceTemplateService.TemplateInput(departmentCode, templateName, sheetName, 1, sections, subjectUserId, fields);
  }

  private List<PerformanceTemplateService.ScopeInput> parseScopes(String raw, String departmentCode) {
    if (raw == null || raw.isBlank() || raw.contains("各部门")) return List.of(new PerformanceTemplateService.ScopeInput("ALL", null));
    var result = new ArrayList<PerformanceTemplateService.ScopeInput>();
    for (String token : raw.split("[/、,，;；\\n]")) {
      String value = token.trim(); if (value.isBlank()) continue;
      String normalized = normalizeDepartment(value);
      if (DEPARTMENTS.containsKey(normalized)) result.add(new PerformanceTemplateService.ScopeInput("DEPARTMENT", DEPARTMENTS.get(normalized)));
      else if (MANAGER_NAMES.stream().anyMatch(value::contains)) result.add(new PerformanceTemplateService.ScopeInput("ROLE", "MANAGER"));
      else result.add(new PerformanceTemplateService.ScopeInput("ROLE", value));
    }
    var unique = new LinkedHashMap<String,PerformanceTemplateService.ScopeInput>();
    result.forEach(scope -> unique.put(scope.type()+":"+Objects.toString(scope.value(),""), scope));
    return unique.isEmpty() ? List.of(new PerformanceTemplateService.ScopeInput("ALL", null)) : List.copyOf(unique.values());
  }

  private String normalizeDepartment(String value) { return value.replaceAll("（.*?）|\\(.*?\\)", "").replace("部门", "部").trim(); }
  private static String text(Sheet sheet, int row, int col) { return mergedText(sheet, row, col); }
  private static String mergedText(Sheet sheet, int row, int col) {
    for (CellRangeAddress region : sheet.getMergedRegions()) if (region.isInRange(row, col)) return cell(sheet.getRow(region.getFirstRow()), region.getFirstColumn());
    return cell(sheet.getRow(row), col);
  }
  private static boolean isMergeStart(Sheet sheet, int row, int col) {
    for (CellRangeAddress region : sheet.getMergedRegions()) if (region.isInRange(row, col)) return region.getFirstRow() == row;
    return sheet.getRow(row) != null && sheet.getRow(row).getCell(col) != null && !cell(sheet.getRow(row), col).isBlank();
  }
  private static String cell(Row row, int col) { if (row == null || row.getCell(col) == null) return ""; return new DataFormatter().formatCellValue(row.getCell(col)).trim(); }
  private static BigDecimal decimal(String value) { try { return value == null || value.isBlank() ? null : new BigDecimal(value.replace(",", "").trim()); } catch (NumberFormatException ignored) { return null; } }
  private void validateFile(MultipartFile file) { if (file == null || file.isEmpty()) throw bad("PERFORMANCE_EXCEL_EMPTY", "请选择 Excel 文件"); if (file.getSize() > 10 * 1024 * 1024) throw bad("PERFORMANCE_EXCEL_TOO_LARGE", "Excel 文件不能超过 10MB"); String name = Objects.toString(file.getOriginalFilename(), "").toLowerCase(Locale.ROOT); if (!name.endsWith(".xlsx")) throw bad("PERFORMANCE_EXCEL_TYPE", "仅支持 .xlsx 文件"); try (InputStream in = file.getInputStream()) { if (in.read() != 'P' || in.read() != 'K') throw bad("PERFORMANCE_EXCEL_MAGIC", "文件内容不是有效的 XLSX"); } catch (ResponseStatusException ex) { throw ex; } catch (Exception ex) { throw bad("PERFORMANCE_EXCEL_READ", "文件读取失败"); } }
  private ResponseStatusException bad(String code, String message) { return new ResponseStatusException(HttpStatus.BAD_REQUEST, code + ": " + message); }
  private String message(Throwable t) { return t.getMessage() == null ? t.getClass().getSimpleName() : t.getMessage(); }
}
