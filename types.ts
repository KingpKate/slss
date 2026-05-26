
// =============================================================================
// SLSS V2.0 Type Definitions
// 服务器全生命周期系统 - 完整类型定义
// =============================================================================

// =============================================================================
// PART 1: EXISTING TYPES (V1.0 - preserved)
// =============================================================================

export enum UserRole {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  TECHNICIAN = 'TECHNICIAN',
  PRODUCTION = 'PRODUCTION',
  // V2.0 New Roles:
  SALES = 'SALES',
  FINANCE = 'FINANCE',
  PROCUREMENT = 'PROCUREMENT',
  PRODUCT = 'PRODUCT'
}

export type Permission =
  | 'VIEW_DASHBOARD'
  | 'MANAGE_SYSTEM'
  | 'VIEW_ORDERS'
  | 'MANAGE_ORDERS'
  | 'DESIGN_PROCESS'
  | 'PROD_ENTRY_ASSEMBLY'
  | 'PROD_ENTRY_INSPECT_INIT'
  | 'PROD_ENTRY_AGING'
  | 'PROD_ENTRY_INSPECT_FINAL'
  | 'PROD_REPAIR'
  | 'PROD_QUERY'
  // V2.0 Financial Permissions:
  | 'FIN_VIEW_QUOTATION'
  | 'FIN_CREATE_QUOTATION'
  | 'FIN_PRODUCT_REVIEW'
  | 'FIN_PROCUREMENT_PRICE'
  | 'FIN_APPROVE_MARGIN'
  | 'FIN_INITIATE_PROJECT'
  | 'FIN_PROCUREMENT_EXECUTE'
  | 'FIN_BUSINESS_TRACK'
  | 'FIN_SETTLEMENT'
  | 'FIN_PAYMENT_REVIEW'
  | 'FIN_VIEW_DASHBOARD'
  // V2.0 Enhanced Production Permissions:
  | 'PROD_MANAGE_SETTINGS'
  | 'PROD_MANAGE_SCAN_TPL'
  | 'PROD_SOP_MANAGE'
  | 'PROD_SHIPPING'
  // V3.0 MES Permissions:
  | 'WS_VIEW'
  | 'WS_MANAGE'
  | 'ROUTING_VIEW'
  | 'ROUTING_MANAGE'
  | 'WO_VIEW'
  | 'WO_MANAGE'
  | 'WO_SCHEDULE'
  | 'INSP_VIEW'
  | 'INSP_EXECUTE'
  | 'SPC_VIEW'

export enum OrderStatus {
  PENDING = 'PENDING',
  ASSIGNED = 'ASSIGNED',
  CHECKING = 'CHECKING',
  QA_AGING = 'QA_AGING',
  SHIPPED = 'SHIPPED',
  CLOSED = 'CLOSED'
}

export enum DiscoveryPhase {
  IN_USE = '使用中',
  UNUSED = '未使用',
  PRODUCTION_RETURN = '生产返回',
  LOAN_RETURN = '借测归还',
  TEST_RETURN = '退测',
  OTHER = '其他'
}

export interface User {
  id: number;
  username: string;
  password?: string;
  role: UserRole;
  permissions: Permission[];
  status: 'active' | 'pending';
  phone?: string;
  department?: string;
}

export interface Asset {
  id?: string;
  contract_no: string;
  customer_name?: string;
  batch_name?: string;
  invoice_date: string;
  model: string;
  machine_sn: string;
  production_stage?: string;
  current_operator?: string;

  mb_model?: string;
  mb_sn?: string;
  mb_operator?: string;
  cpu_model?: string;
  cpu_sn?: string;
  cpu_sn_2?: string;
  cpu_operator?: string;
  psu_info?: string;
  psu_cage_sn?: string;
  psu_module_1_sn?: string;
  psu_module_2_sn?: string;
  psu_operator?: string;
  hdd_info?: string;
  hdd_sn?: string;
  hdd_operator?: string;
  mem_info?: string;
  mem_sns?: string;
  mem_operator?: string;
  pcie_sn?: string;
  pcie_operator?: string;

  created_at?: string;
  factory_config_json?: string;

  [key: string]: any;
}

export interface TestReport {
  id: number;
  machine_sn: string;
  test_type: 'STRESS_CPU' | 'MEMTEST' | 'IO_CHECK';
  status: 'PASS' | 'FAIL';
  log_snippet: string;
  report_url?: string;
  timestamp: string;
}

export interface LogisticsRecord {
  id: number;
  order_id: number;
  status: string;
  location: string;
  timestamp: string;
}

export interface RepairPartItem {
  id: string;
  part_name: string;
  old_sn: string;
  new_sn: string;
}

// --- Dynamic Process & Form Types ---

export type FormFieldType =
  | 'text' | 'textarea' | 'number'
  | 'select' | 'radio' | 'checkbox'
  | 'date' | 'time'
  | 'user' | 'dept'
  | 'file'
  | 'divider' | 'note';

export interface FormFieldConfig {
  id: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  options?: string[];
  placeholder?: string;
  width?: 'full' | 'half';
  description?: string;
  defaultValue?: any;
}

export interface WorkflowNode {
  id: string;
  name: string;
  type: 'start' | 'process' | 'end' | 'parallel' | 'exclusive';
  role: UserRole | 'ALL';
  nextNodes: string[];
}

export interface ProcessTemplate {
  id: string;
  name: string;
  description?: string;
  targetModule: 'service' | 'production';
  formSchema: FormFieldConfig[];
  workflow: WorkflowNode[];
  created_at: string;
  updated_at: string;
}

export interface RepairOrder {
  id: number;
  order_number: string;
  machine_sn: string;
  customer_name: string;
  fault_description: string;
  discovery_phase: DiscoveryPhase;

  shipment_model?: string;
  shipment_date?: string;
  shipment_config_json?: string;
  received_config_json?: string;
  actual_fault_description?: string;
  parts_list?: RepairPartItem[];
  report_data_json?: string;

  status: OrderStatus | string;
  assigned_to?: number;
  logistics_provider?: string;
  tracking_number?: string;

  template_id?: string;
  module?: 'service' | 'production';
  current_node_id?: string;
  dynamic_data?: Record<string, any>;

  created_at: string;
  updated_at: string;
}

export interface LifecycleEvent {
  id: number;
  machine_sn: string;
  event_type: 'FACTORY_SHIP' | 'REPAIR_SWAP' | 'STRESS_TEST' | 'LOGISTICS_UPDATE' | 'PROD_STAGE' | 'PROD_REPAIR';
  part_name?: string;
  old_sn?: string;
  new_sn?: string;
  bad_part_reason?: string;
  operator?: string;
  timestamp: string;
  technician_name?: string;
  details?: string;
}

// --- Configuration Types ---

export type DatabaseType = 'mysql' | 'postgres' | 'oracle' | 'sqlite';
export interface DatabaseConfig {
  type: DatabaseType;
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  databaseName?: string;
  filePath?: string;
  ssl?: boolean;
}
export interface RedisConfig {
  enabled: boolean;
  host: string;
  port: number;
  password?: string;
  dbIndex: number;
}
export interface AIConfig {
  provider: 'google' | 'openai' | 'deepseek' | 'zhipu' | 'modelscope' | 'custom';
  model: string;
  baseUrl: string;
  apiKey: string;
}
export interface SMTPConfig {
  enabled: boolean;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromName: string;
  fromEmail: string;
}
export interface RobotConfig {
  wecom: { enabled: boolean; webhook: string; };
  dingtalk: { enabled: boolean; webhook: string; secret?: string; };
  feishu: { enabled: boolean; webhook: string; };
}
export interface NotificationConfig {
  smtp: SMTPConfig;
  robots: RobotConfig;
}
export interface SystemSettings {
  appName: string;
  maintenanceMode: boolean;
  logRetentionDays: number;
  defaultAssigneeId?: number;
  productionOperators?: string[];
  // V2.0 Settings:
  quotation_validity_hours?: number;   // 报价有效期(小时), 默认72
  inventory_aging_days?: number;       // 库龄预警天数, 默认5
  delivery_reminder_days?: number;     // 交期提醒天数, 默认7
  defect_rate_lock_threshold?: number; // 不良率锁定阈值(%), 默认3
  // MES Configuration:
  quality_lock_threshold?: number;      // 质量全局熔断阈值(%), 默认3
  scheduling_strategy?: 'EDD' | 'FIFO'; // 默认排程策略, 默认'EDD'
  dashboard_refresh_seconds?: number;   // 车间大屏刷新频率(秒), 默认30
}
export interface SystemStatus {
  cpuUsage: number;
  memoryUsage: number;
  uptime: number;
  dbStatus: 'connected' | 'disconnected' | 'latency_high';
  dbLatency: number;
  redisStatus: 'connected' | 'disconnected' | 'disabled';
  activeConnections: number;
}

// =============================================================================
// PART 2: V2.0 NEW TYPES - 财务模块 (Financial Module)
// =============================================================================

// 2.1 报价单状态
export enum QuotationStatus {
  DRAFT = 'DRAFT',
  SUBMITTED_TO_PRODUCT = 'SUBMITTED_TO_PRODUCT',
  PRODUCT_REVIEWING = 'PRODUCT_REVIEWING',
  TESTING = 'TESTING',
  PROCUREMENT_PRICING = 'PROCUREMENT_PRICING',
  PRICING_COMPLETED = 'PRICING_COMPLETED',
  MARGIN_REVIEW = 'MARGIN_REVIEW',
  MARGIN_REJECTED = 'MARGIN_REJECTED',
  APPROVED = 'APPROVED',
  PROJECT_INITIATED = 'PROJECT_INITIATED',
  ABANDONED = 'ABANDONED',
  EXPIRED = 'EXPIRED'
}

// 2.2 采购订单状态
export enum PurchaseOrderStatus {
  PENDING = 'PENDING',
  ORDERED = 'ORDERED',
  SHIPPED = 'SHIPPED',
  IN_TRANSIT = 'IN_TRANSIT',
  ARRIVED = 'ARRIVED',
  INSPECTED = 'INSPECTED',
  SETTLEMENT_READY = 'SETTLEMENT_READY'
}

// 2.3 结算状态
export enum SettlementStatus {
  PENDING = 'PENDING',
  INVOICED = 'INVOICED',
  PARTIAL_PAID = 'PARTIAL_PAID',
  FULLY_PAID = 'FULLY_PAID',
  OVERDUE = 'OVERDUE'
}

// 2.4 付款方式
export enum PaymentType {
  CASH = 'CASH',
  CREDIT = 'CREDIT'
}

// 2.5 回款审核状态
export enum PaymentRecordStatus {
  PENDING_SALES_CONFIRM = 'PENDING_SALES_CONFIRM',
  PENDING_FINANCE_REVIEW = 'PENDING_FINANCE_REVIEW',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED'
}

// 2.6 利润审批类型
export enum MarginApprovalType {
  NORMAL = 'NORMAL',
  STRATEGIC = 'STRATEGIC',
  LARGE_ORDER = 'LARGE_ORDER'
}

// 2.7 BOM组件项
export interface BomItem {
  id: string;
  component_type: 'cpu' | 'mem' | 'hdd' | 'mb' | 'psu' | 'pcie' | 'gpu' | 'nic' | 'raid' | 'chassis' | 'other';
  component_type_label: string;
  model: string;
  brand?: string;
  quantity: number;
  unit_price_selling?: number;
  unit_cost?: number;
  supplier?: string;
  lead_time_days?: number;
  notes?: string;
}

// 2.8 物流轨迹事件
export interface ExpressEvent {
  time: string;
  status: string;
  location: string;
  description: string;
}

// 2.9 财务报价单
export interface FinQuotation {
  id: string;
  project_name: string;
  customer_name: string;
  sales_user_id: number;
  sales_user_name: string;
  bom_items: BomItem[];
  status: QuotationStatus;

  // 报价有效期
  valid_until: string;
  is_expired: boolean;

  // 产品评估
  product_reviewer_id?: number;
  product_review_comment?: string;
  whole_machine_bom?: BomItem[];
  needs_testing: boolean;

  // 利润审核
  total_cost: number;
  profit_margin_rate: number;
  selling_price_total: number;
  margin_type: MarginApprovalType;
  margin_approved_by?: number;
  margin_approved_at?: string;
  margin_rejection_reason?: string;
  approval_attachments?: string[]; // 附件URL列表

  // 立项
  project_initiated_at?: string;
  server_config?: string;
  software_requirements?: string;
  delivery_date?: string;
  delivery_address?: string;
  special_notes?: string;

  created_at: string;
  updated_at: string;
}

// 2.10 采购订单
export interface FinPurchaseOrder {
  id: string;
  quotation_id: string;
  procurement_user_id: number;
  procurement_user_name: string;

  initial_form_price?: number;
  payment_terms?: string;
  expected_delivery_date?: string;

  // 快递信息
  express_company?: string;
  tracking_number?: string;
  express_status?: string;
  express_last_update?: string;
  express_details?: ExpressEvent[];

  // 到货信息
  arrived_at?: string;
  arrival_notified: boolean;

  // 开箱检验
  expected_quantity: number;
  actual_quantity?: number;
  inspection_notes?: string;
  quantity_discrepancy: number;
  frozen_amount: number;

  status: PurchaseOrderStatus;
  created_at: string;
  updated_at: string;
}

// 2.11 采购定价明细
export interface FinBomPricing {
  id: number;
  quotation_id: string;
  component_type: string;
  component_model: string;
  component_brand?: string;
  quantity: number;
  unit_cost?: number;
  supplier?: string;
  lead_time_days?: number;
  notes?: string;
}

// 2.12 测试流程
export interface FinTestProcess {
  id: number;
  quotation_id: string;
  test_type: string;
  test_items?: string[];
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  result_summary?: string;
  tester_id?: number;
  tester_name?: string;
  started_at?: string;
  completed_at?: string;
}

// 2.13 商务追踪
export interface FinBusinessTracking {
  id: number;
  purchase_order_id: string;
  quotation_id: string;
  business_user_id: number;
  business_user_name: string;
  expected_delivery_date?: string;
  reminder_days_before: number;
  reminder_sent: boolean;
  reminder_sent_at?: string;
  actual_arrival_date?: string;
  delivery_status: 'ON_TIME' | 'DELAYED' | 'UNKNOWN';
  notes?: string;
}

// 2.14 生产衔接
export interface FinProductionLink {
  id: number;
  purchase_order_id: string;
  quotation_id: string;
  contract_no?: string;
  materials_received: boolean;
  inventory_completed: boolean;
  transferred_to_production: boolean;
  production_completed: boolean;
  shipped: boolean;
  shipped_at?: string;
  shipping_tracking_number?: string;
  // 库龄追踪
  inventory_date?: string;
  material_picked_date?: string;
  inventory_aging_days: number;
  aging_alert_sent: boolean;
}

// 2.15 财务结算
export interface FinSettlement {
  id: number;
  quotation_id: string;
  purchase_order_id?: string;
  total_amount: number;
  cost_amount: number;
  profit_amount: number;
  payment_terms?: string;
  payment_type: PaymentType;
  credit_days: number;
  settlement_start_date?: string;
  payment_due_date?: string;
  amount_received: number;
  amount_pending: number;
  last_payment_date?: string;
  status: SettlementStatus;
  confirmed_by_sales?: number;
  reviewed_by_finance?: number;
}

// 2.16 回款记录
export interface FinPaymentRecord {
  id: number;
  settlement_id: number;
  quotation_id: string;
  amount: number;
  payment_date: string;
  payment_method?: string;
  reference_number?: string;
  confirmed_by_sales?: number;
  reviewed_by_finance?: number;
  finance_reviewed_at?: string;
  notes?: string;
  status: PaymentRecordStatus;
}

// 2.17 销售预算
export interface FinSalesBudget {
  id: number;
  sales_user_id: number;
  sales_user_name: string;
  budget_year: number;
  budget_month?: number;
  budget_amount: number;
  occupied_amount: number;
}

// 2.18 财务数据透视汇总
export interface FinanceDashboardSummary {
  total_quotations: number;
  active_projects: number;
  total_revenue: number;
  total_cost: number;
  total_profit: number;
  total_outstanding: number;
  overdue_amount: number;
  overdue_count: number;
  inventory_aging_alerts: InventoryAgingAlert[];

  sales_budget_usage: {
    sales_user_id: number;
    sales_user_name: string;
    budget_amount: number;
    occupied_amount: number;
    utilization_rate: number;
  }[];

  monthly_revenue: {
    month: string;
    revenue: number;
    cost: number;
    profit: number;
  }[];

  top_customers: {
    customer_name: string;
    total_amount: number;
    project_count: number;
  }[];

  delivery_countdown: DeliveryCountdownItem[];
}

// 2.20 交付倒计时
export interface DeliveryCountdownItem {
  id: number;
  quotation_id: string;
  project_name: string;
  customer_name: string;
  delivery_date: string;
  days_remaining: number;
  amount: number;
}

// 2.19 库龄预警
export interface InventoryAgingAlert {
  purchase_order_id: string;
  quotation_id: string;
  customer_name: string;
  inventory_date: string;
  aging_days: number;
  threshold_days: number;
  is_alerted: boolean;
}

// =============================================================================
// PART 3: V2.0 NEW TYPES - 增强生产模块 (Enhanced Production)
// =============================================================================

// 3.1 故障类别 (FMEA)
export enum FaultCategory {
  CAN_NOT_BOOT = 'CAN_NOT_BOOT',
  MEM_ERROR = 'MEM_ERROR',
  PHYSICAL_DAMAGE = 'PHYSICAL_DAMAGE',
  DOA = 'DOA',
  DISK_ERROR = 'DISK_ERROR',
  PSU_FAILURE = 'PSU_FAILURE',
  NETWORK_ERROR = 'NETWORK_ERROR',
  OVERHEATING = 'OVERHEATING',
  OTHER = 'OTHER'
}

export const FAULT_CATEGORY_LABELS: Record<FaultCategory, string> = {
  [FaultCategory.CAN_NOT_BOOT]: '无法开机',
  [FaultCategory.MEM_ERROR]: '内存报错',
  [FaultCategory.PHYSICAL_DAMAGE]: '物理损坏',
  [FaultCategory.DOA]: 'DOA(到货即损)',
  [FaultCategory.DISK_ERROR]: '硬盘故障',
  [FaultCategory.PSU_FAILURE]: '电源故障',
  [FaultCategory.NETWORK_ERROR]: '网络故障',
  [FaultCategory.OVERHEATING]: '过热',
  [FaultCategory.OTHER]: '其他'
};

// 3.2 扫码模版
export interface ScanTemplate {
  id: string;
  name: string;
  model?: string;
  description?: string;
  scan_items: ScanItem[];
  created_by?: number;
  created_at: string;
  updated_at: string;
}

// 3.3 扫码项目定义
export interface ScanItem {
  component_type: string;
  label: string;
  sn_count: number;
  required: boolean;
  bom_field_key: string;
}

// 3.4 扫码记录
export interface ScanRecord {
  id: number;
  machine_sn: string;
  contract_no?: string;
  scan_template_id?: string;
  hardware_data: Record<string, Array<{ sn: string; model?: string }>>;
  operator_id?: number;
  operator_name?: string;
  scan_stage: 'ASSEMBLY' | 'INITIAL_INSPECT' | 'AGING' | 'FINAL_INSPECT';
  created_at: string;
  updated_at: string;
}

// 3.5 SOP文档
export interface SopDocument {
  id: number;
  title: string;
  category?: string;
  model?: string;
  content: string;
  video_url?: string;
  critical_checkpoints?: CriticalCheckpoint[];
  attachments?: string[];
  sort_order: number;
  is_active: boolean;
  created_by?: number;
  created_at: string;
  updated_at: string;
}

// 3.6 关键工序确认项
export interface CriticalCheckpoint {
  id: string;
  label: string;
  required: boolean;
  checked?: boolean;
}

// 3.7 生产员工权限
export interface ProdEmployeePermission {
  id: number;
  user_id: number;
  employee_name: string;
  can_scan_assembly: boolean;
  can_scan_inspect_init: boolean;
  can_scan_aging: boolean;
  can_scan_inspect_final: boolean;
  can_repair: boolean;
  can_query: boolean;
  can_manage_scan_templates: boolean;
  is_active: boolean;
}

// 3.8 FMEA故障记录
export interface FaultRecord {
  id: number;
  machine_sn: string;
  part_name: string;
  part_sn: string;
  fault_category: FaultCategory;
  fault_mode?: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  batch_no?: string;
  supplier?: string;
  operator_id?: number;
  operator_name?: string;
  created_at: string;
}

// 3.9 配件不良率热力图数据
export interface DefectRateHeatmap {
  part_name: string;
  batch_no: string;
  supplier: string;
  total_installed: number;
  total_faulty: number;
  defect_rate: number;
  should_lock_settlement: boolean;
}

// 3.10 发货记录
export interface ShippingRecord {
  id: number;
  machine_sn?: string;
  contract_no?: string;
  quotation_id?: string;
  express_company: string;
  tracking_number: string;
  recipient_name?: string;
  recipient_address?: string;
  recipient_phone?: string;
  express_status?: string;
  express_details?: ExpressEvent[];
  last_tracked_at?: string;
  settlement_signal_sent: boolean;
  settlement_signal_at?: string;
  shipped_at: string;
  delivered_at?: string;
}

// 3.11 组件类型定义
export interface ComponentTypeDefinition {
  key: string;
  label: string;
  icon?: string;
  colorClass: string;
  default_sn_count: number;
}

export const COMPONENT_TYPES: ComponentTypeDefinition[] = [
  { key: 'mb', label: '主板 (MB)', colorClass: 'blue', default_sn_count: 1 },
  { key: 'cpu', label: 'CPU', colorClass: 'purple', default_sn_count: 2 },
  { key: 'mem', label: '内存 (Mem)', colorClass: 'green', default_sn_count: 4 },
  { key: 'hdd', label: '硬盘 (HDD)', colorClass: 'orange', default_sn_count: 8 },
  { key: 'psu', label: '电源 (PSU)', colorClass: 'yellow', default_sn_count: 2 },
  { key: 'pcie', label: 'PCIE 扩展卡', colorClass: 'gray', default_sn_count: 1 },
  { key: 'gpu', label: 'GPU', colorClass: 'red', default_sn_count: 1 },
  { key: 'nic', label: '网卡 (NIC)', colorClass: 'cyan', default_sn_count: 2 },
  { key: 'raid', label: 'RAID卡', colorClass: 'pink', default_sn_count: 1 },
  { key: 'chassis', label: '机箱 (Chassis)', colorClass: 'slate', default_sn_count: 1 },
];

// =============================================================================
// PART 4: V2.0 NEW TYPES - 消息路由中心 (Message Router)
// =============================================================================

export type MessageEventType =
  | 'FAULT_CRITICAL'
  | 'FAULT_SWAP'
  | 'DELIVERY_REMINDER'
  | 'ARRIVAL'
  | 'AGING_ALERT'
  | 'SETTLEMENT_READY'
  | 'OVERDUE_PAYMENT'
  | 'ORDER_CREATED'
  | 'ORDER_ASSIGNED'
  | 'ORDER_CLOSED'
  // V3.0 MES Events:
  | 'WORK_ORDER_OVERDUE'
  | 'WORK_ORDER_COMPLETED'
  | 'INSPECTION_FAILED'
  | 'SPC_OUT_OF_CONTROL';

export type MessageChannel = 'wecom' | 'dingtalk' | 'feishu' | 'email' | 'all';

export interface MessageRouteRule {
  id: string;
  event_type: MessageEventType;
  channel: MessageChannel;
  target_roles: string[];
  target_users: number[];
  schedule?: string;
  severity_filter?: string;
  template: string;
  is_active: boolean;
}

export interface MessagePayload {
  event_type: MessageEventType;
  title: string;
  content: string;
  data?: Record<string, any>;
  target_roles?: string[];
  target_users?: number[];
  channel?: MessageChannel;
  immediate?: boolean;
}

// =============================================================================
// PART 5: V3.0 NEW TYPES - MES Core Features
// =============================================================================

// --- Workstation ---
export enum WorkstationStatus {
  IDLE = 'IDLE',
  RUNNING = 'RUNNING',
  MAINTENANCE = 'MAINTENANCE',
  OFFLINE = 'OFFLINE',
}

export interface Workstation {
  id: number;
  name: string;
  code: string;
  line: string;
  location: string;
  capabilities: string[] | null;
  status: WorkstationStatus;
  current_operator_id: number | null;
  max_concurrent_tasks: number;
  notes: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type MaintenanceType = 'PREVENTIVE' | 'CORRECTIVE' | 'CALIBRATION';
export type MaintenanceStatus = 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED';

export interface MaintenanceRecord {
  id: number;
  workstation_id: number;
  type: MaintenanceType;
  description: string;
  performed_by: string;
  started_at: string;
  completed_at: string | null;
  status: MaintenanceStatus;
}

// --- Routing ---
export interface RoutingTemplate {
  id: string;
  name: string;
  model: string;
  description: string;
  steps: RoutingStep[];
  is_active: boolean;
  created_by?: number;
  created_at?: string;
  updated_at?: string;
}

export interface RoutingStep {
  id: number;
  routing_id: string;
  step_seq: number;
  step_name: string;
  workstation_id: number | null;
  standard_time_min: number;
  sop_document_id: number | null;
  is_required: boolean;
  description: string;
}

// --- Work Order ---
export enum WorkOrderStatus {
  QUEUED = 'QUEUED',
  IN_PROGRESS = 'IN_PROGRESS',
  BLOCKED = 'BLOCKED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export interface WorkOrder {
  id: string;
  machine_sn: string;
  contract_no: string;
  quotation_id: string;
  routing_id: string;
  current_step_seq: number;
  status: WorkOrderStatus;
  priority: number;
  planned_start: string | null;
  planned_end: string | null;
  actual_start: string | null;
  actual_end: string | null;
  assigned_to: number | null;
  notes: string;
  created_at?: string;
  updated_at?: string;
}

// --- Inspection ---
export interface InspectionItem {
  name: string;
  spec_min: number;
  spec_max: number;
  unit: string;
  method: string;
}

export interface InspectionPlan {
  id: number;
  name: string;
  category: string;
  applicable_model: string | null;
  items: InspectionItem[];
  is_active: boolean;
  created_by?: number;
  created_at?: string;
}

export interface InspectionResult {
  id: number;
  plan_id: number;
  machine_sn: string;
  work_order_id: string | null;
  inspector_id: number | null;
  inspector_name: string;
  results: Record<string, { value: number; pass: boolean }>;
  overall_result: 'PASS' | 'FAIL' | 'CONDITIONAL';
  notes: string;
  inspected_at: string;
}

// --- Material Usage ---
export interface MaterialUsage {
  id: number;
  machine_sn: string;
  work_order_id: string | null;
  component_type: string;
  component_model: string;
  bom_planned_qty: number;
  actual_qty: number;
  variance_reason: string;
  operator_id: number | null;
  operator_name: string;
  recorded_at: string;
}

// --- SPC ---
export interface Measurement {
  id: number;
  machine_sn: string;
  work_order_id: string | null;
  routing_step_id: number | null;
  parameter_name: string;
  value: number;
  unit: string;
  spec_min: number | null;
  spec_max: number | null;
  operator_id: number | null;
  recorded_at: string;
}

export interface ControlLimits {
  center_line: number;
  ucl: number;
  lcl: number;
  r_bar: number;
}

export interface SPCChartData {
  data_points: { index: number; value: number; timestamp: string; out_of_control: boolean }[];
  control_limits: ControlLimits;
  stats: { mean: number; std_dev: number; cp: number | null; cpk: number | null; n: number };
}

// --- Scheduling ---
export interface ScheduleEntry {
  work_order_id: string;
  machine_sn: string;
  routing_name: string;
  workstation_id: number | null;
  workstation_name: string;
  step_seq: number;
  step_name: string;
  planned_start: string;
  planned_end: string;
  status: WorkOrderStatus;
  priority: number;
}

export interface CapacityInfo {
  workstation_id: number;
  workstation_name: string;
  current_tasks: number;
  max_tasks: number;
  utilization_pct: number;
}
