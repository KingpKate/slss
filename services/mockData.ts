

import {
  User, UserRole, OrderStatus, RepairOrder, Asset, LifecycleEvent,
  TestReport, LogisticsRecord, DiscoveryPhase,
  FinQuotation, QuotationStatus, MarginApprovalType,
  FinPurchaseOrder, PurchaseOrderStatus,
  FinSettlement, SettlementStatus, PaymentType,
  FinPaymentRecord, PaymentRecordStatus,
  ScanTemplate, FaultRecord, FaultCategory,
  FinBusinessTracking, FinProductionLink, SopDocument,
  DefectRateHeatmap, DeliveryCountdownItem
} from "../types";

// Bcrypt-hashed password for 'Gyh@20210625'
const HASHED_ADMIN_PASSWORD = '$2b$10$MsCXZ3KkMSBPKl/6kbgbk.EZDiwrek8kPUJyDc1nYDv63yirAglPa';

export const MOCK_USERS: User[] = [
  {
    id: 1,
    username: 'stars',
    password: HASHED_ADMIN_PASSWORD,
    role: UserRole.ADMIN,
    status: 'active',
    permissions: [
      'VIEW_DASHBOARD', 'MANAGE_SYSTEM',
      'VIEW_ORDERS', 'MANAGE_ORDERS', 'DESIGN_PROCESS',
      'PROD_ENTRY_ASSEMBLY', 'PROD_ENTRY_INSPECT_INIT', 'PROD_ENTRY_AGING',
      'PROD_ENTRY_INSPECT_FINAL', 'PROD_REPAIR', 'PROD_QUERY',
      'FIN_VIEW_QUOTATION', 'FIN_CREATE_QUOTATION', 'FIN_PRODUCT_REVIEW', 'FIN_PROCUREMENT_PRICE',
      'FIN_APPROVE_MARGIN', 'FIN_INITIATE_PROJECT', 'FIN_PROCUREMENT_EXECUTE', 'FIN_BUSINESS_TRACK',
      'FIN_SETTLEMENT', 'FIN_PAYMENT_REVIEW', 'FIN_VIEW_DASHBOARD',
      'PROD_MANAGE_SETTINGS', 'PROD_MANAGE_SCAN_TPL', 'PROD_SOP_MANAGE', 'PROD_SHIPPING'
    ]
  },
  {
    id: 2,
    username: 'sales01',
    password: HASHED_ADMIN_PASSWORD,
    role: UserRole.SALES,
    status: 'active',
    permissions: ['VIEW_DASHBOARD', 'FIN_VIEW_QUOTATION', 'FIN_CREATE_QUOTATION', 'FIN_INITIATE_PROJECT', 'FIN_BUSINESS_TRACK', 'FIN_PAYMENT_REVIEW', 'FIN_VIEW_DASHBOARD']
  },
  {
    id: 3,
    username: 'finance01',
    password: HASHED_ADMIN_PASSWORD,
    role: UserRole.FINANCE,
    status: 'active',
    permissions: ['VIEW_DASHBOARD', 'FIN_VIEW_QUOTATION', 'FIN_SETTLEMENT', 'FIN_PAYMENT_REVIEW', 'FIN_VIEW_DASHBOARD']
  },
  {
    id: 4,
    username: 'procurement01',
    password: HASHED_ADMIN_PASSWORD,
    role: UserRole.PROCUREMENT,
    status: 'active',
    permissions: ['VIEW_DASHBOARD', 'FIN_VIEW_QUOTATION', 'FIN_PROCUREMENT_PRICE', 'FIN_PROCUREMENT_EXECUTE']
  },
  {
    id: 5,
    username: 'product01',
    password: HASHED_ADMIN_PASSWORD,
    role: UserRole.PRODUCT,
    status: 'active',
    permissions: ['VIEW_DASHBOARD', 'FIN_VIEW_QUOTATION', 'FIN_PRODUCT_REVIEW']
  }
];

export const MOCK_ASSETS: Asset[] = [
  {
    contract_no: '551C FKF',
    invoice_date: '2023-01-15',
    model: '551C FKF',
    machine_sn: 'HM217S007647',
    mb_model: 'X11DPI-N',
    mb_sn: '223B20146',
    mb_operator: '王树鹏',
    cpu_model: '5115',
    cpu_sn: 'M93B5J2600159',
    cpu_sn_2: 'M8Y162M800360',
    cpu_operator: '刘峻良',
    psu_info: '康舒 800W',
    psu_cage_sn: 'ZH0821102100562A00',
    psu_module_1_sn: 'FSE052A0400CGB2201000999',
    psu_module_2_sn: 'FSE052A0400CGB2201000661',
    psu_operator: '刘鎏',
    hdd_info: 'WD 4T',
    hdd_sn: 'BS0405ZH',
    hdd_operator: '乔洪泽',
    mem_info: '三星 32G 2933',
    mem_sns: 'K1CJ00011819B507B6, K1DL00011819B68083, K1DL00011819B63343',
    mem_operator: '于顺堂',
    pcie_sn: '',
    created_at: '2023-01-15',
    batch_name: 'IMPORT_TEST_001',
    factory_config_json: JSON.stringify({
      mb: { model: 'X11DPI-N', sn: '223B20146' },
      cpu: [{ model: '5115', sn: 'M93B5J2600159' }, { sn: 'M8Y162M800360' }],
      psu: { info: '康舒 800W', cage_sn: 'ZH0821102100562A00' },
      storage: { model: 'WD 4T', sn: 'BS0405ZH' },
      memory: { model: '三星 32G 2933', sns: 'K1CJ00011819B507B6, K1DL00011819B68083' }
    })
  },
  {
    contract_no: 'CONT-2023002',
    invoice_date: '2023-02-20',
    model: '551C FKF',
    machine_sn: 'SRV-2023-002',
    mb_model: 'X11DPI-N',
    mb_sn: 'I721A1846',
    cpu_model: '5115',
    cpu_sn: 'M0C084J800232',
    psu_info: '康舒 800W',
    psu_cage_sn: 'ZH0824041500293A00',
    psu_module_1_sn: 'FSE052A0400CGB25280',
    created_at: '2023-02-20',
    batch_name: 'PROD_20230220_0900',
    factory_config_json: JSON.stringify({
      mb: { model: 'X11DPI-N', sn: 'I721A1846' },
      cpu: [{ model: '5115', sn: 'M0C084J800232' }],
      psu: { info: '康舒 800W' }
    })
  },
  {
    contract_no: 'CONT-2023003',
    invoice_date: '2023-03-10',
    model: '5406 FAF',
    machine_sn: 'WARN-2023-REPEAT',
    mb_model: 'X11DPI-N',
    mb_sn: 'OLD-MB-001',
    created_at: '2023-03-10',
    batch_name: 'PROD_20230310_0900',
    factory_config_json: '{}'
  }
];

export const MOCK_ORDERS: RepairOrder[] = [
  {
    id: 101, order_number: 'RMA-20231025-01', machine_sn: 'HM217S007647',
    customer_name: '北京字节跳动科技有限公司',
    fault_description: '服务器随机内核崩溃 (Kernel Panic)。客户报告在高负载下系统不稳定。',
    discovery_phase: DiscoveryPhase.IN_USE, status: OrderStatus.CHECKING, assigned_to: 1,
    shipment_model: '551C FKF', shipment_date: '2023-01-15',
    shipment_config_json: MOCK_ASSETS[0].factory_config_json,
    created_at: '2023-10-25T09:00:00Z', updated_at: '2023-10-26T10:00:00Z'
  },
  {
    id: 99, order_number: 'RMA-20230901-05', machine_sn: 'SRV-2023-002',
    customer_name: '阿里巴巴云计算有限公司',
    fault_description: '开机无显示，风扇狂转。已更换内存无效。',
    discovery_phase: DiscoveryPhase.IN_USE, status: OrderStatus.CHECKING, assigned_to: 1,
    created_at: '2023-09-01T09:00:00Z', updated_at: '2023-09-05T10:00:00Z'
  },
  {
    id: 102, order_number: 'RMA-20231027-02', machine_sn: 'WARN-2023-REPEAT',
    customer_name: '腾讯科技(深圳)有限公司',
    fault_description: '主板再次故障，PCIE 无法识别。',
    discovery_phase: DiscoveryPhase.IN_USE, status: OrderStatus.ASSIGNED, assigned_to: 1,
    created_at: '2023-10-27T09:00:00Z', updated_at: '2023-10-27T09:00:00Z'
  },
  { id: 90, order_number: 'RMA-20230801-01', machine_sn: 'SN-001', customer_name: '北京字节跳动科技有限公司', fault_description: 'Mem error', discovery_phase: DiscoveryPhase.IN_USE, status: OrderStatus.CLOSED, created_at: '2023-08-01T09:00:00Z', updated_at: '2023-08-05T10:00:00Z' },
  { id: 91, order_number: 'RMA-20230802-02', machine_sn: 'SN-002', customer_name: '百度在线网络技术有限公司', fault_description: 'HDD fail', discovery_phase: DiscoveryPhase.IN_USE, status: OrderStatus.CLOSED, created_at: '2023-08-02T09:00:00Z', updated_at: '2023-08-06T10:00:00Z' },
  { id: 92, order_number: 'RMA-20230815-03', machine_sn: 'SN-003', customer_name: '北京字节跳动科技有限公司', fault_description: 'PSU fail', discovery_phase: DiscoveryPhase.IN_USE, status: OrderStatus.CLOSED, created_at: '2023-08-15T09:00:00Z', updated_at: '2023-08-16T10:00:00Z' }
];

export const MOCK_LIFECYCLE: LifecycleEvent[] = [
  { id: 1, machine_sn: 'HM217S007647', event_type: 'FACTORY_SHIP', timestamp: '2023-01-15T08:00:00Z', details: '出厂发货' },
  { id: 2, machine_sn: 'HM217S007647', event_type: 'LOGISTICS_UPDATE', timestamp: '2023-10-25T09:00:00Z', details: '收到客户寄修机器，外观完好' },
  { id: 10, machine_sn: 'SN-001', event_type: 'REPAIR_SWAP', part_name: '内存 (Memory)', timestamp: '2023-08-04T10:00:00Z', details: '更换内存' },
  { id: 11, machine_sn: 'SN-002', event_type: 'REPAIR_SWAP', part_name: '硬盘 (Storage)', timestamp: '2023-08-05T10:00:00Z', details: '更换硬盘' },
  { id: 12, machine_sn: 'SN-003', event_type: 'REPAIR_SWAP', part_name: '电源 (PSU)', timestamp: '2023-08-16T10:00:00Z', details: '更换电源模块' },
  { id: 20, machine_sn: 'WARN-2023-REPEAT', event_type: 'REPAIR_SWAP', part_name: '主板 (Motherboard)', old_sn: 'OLD-MB-001', new_sn: 'NEW-MB-001', timestamp: '2023-06-01T10:00:00Z', details: '第一次更换主板' },
  { id: 21, machine_sn: 'WARN-2023-REPEAT', event_type: 'REPAIR_SWAP', part_name: '主板 (Motherboard)', old_sn: 'NEW-MB-001', new_sn: 'NEW-MB-002', timestamp: '2023-10-27T10:00:00Z', details: '第二次更换主板 (Recurring)' }
];

export const MOCK_TEST_REPORTS: TestReport[] = [
  {
    id: 1, machine_sn: 'HM217S007647', test_type: 'STRESS_CPU', status: 'FAIL',
    timestamp: '2023-10-26T11:00:00Z',
    log_snippet: `[11:00:01] Starting Stress Prime 2004 (Ortho)...\n[11:00:05] CPU0: 100% Load, Temp: 65C | Vcore: 1.2V\n[11:10:00] FATAL ERROR: Hardware failure detected at Core #4`
  }
];

export const MOCK_LOGISTICS: LogisticsRecord[] = [
  { id: 1, order_id: 101, status: '已揽收', location: '北京市海淀区上地', timestamp: '2023-10-24T14:00:00Z' },
  { id: 5, order_id: 101, status: '已签收', location: 'SLSS 维修中心收发室', timestamp: '2023-10-25T09:00:00Z' }
];

export const DEFAULT_OPERATORS = [
  "王树鹏", "乔洪泽", "吴及超", "刘峻良", "刘鎏", "于顺堂"
].sort((a, b) => a.localeCompare(b, 'zh-CN'));

// =============================================================================
// V2.0 MOCK DATA - 财务模块
// =============================================================================

const now = new Date();
const validUntil = new Date(now.getTime() + 72 * 60 * 60 * 1000); // 72h from now

export const MOCK_QUOTATIONS: FinQuotation[] = [
  {
    id: 'QUO-20260501-001',
    project_name: '字节跳动CDN节点服务器扩容',
    customer_name: '北京字节跳动科技有限公司',
    sales_user_id: 2,
    sales_user_name: 'sales01',
    bom_items: [
      { id: 'bom-1', component_type: 'cpu', component_type_label: 'CPU', model: 'Intel Xeon 5115', brand: 'Intel', quantity: 2, unit_price_selling: 8500 },
      { id: 'bom-2', component_type: 'mem', component_type_label: '内存', model: '三星 32G DDR4', brand: 'Samsung', quantity: 8, unit_price_selling: 1200 },
      { id: 'bom-3', component_type: 'hdd', component_type_label: '硬盘', model: 'WD 4T SAS', brand: 'WD', quantity: 8, unit_price_selling: 2800 },
      { id: 'bom-4', component_type: 'mb', component_type_label: '主板', model: 'X11DPI-N', brand: 'Supermicro', quantity: 1, unit_price_selling: 6500 },
      { id: 'bom-5', component_type: 'psu', component_type_label: '电源', model: '康舒 800W', brand: 'AcBel', quantity: 2, unit_price_selling: 1800 }
    ],
    status: QuotationStatus.APPROVED,
    valid_until: validUntil.toISOString(),
    is_expired: false,
    needs_testing: false,
    total_cost: 52000,
    profit_margin_rate: 18.5,
    selling_price_total: 64000,
    margin_type: MarginApprovalType.NORMAL,
    project_initiated_at: '2026-05-02T10:00:00Z',
    server_config: '双路Intel Xeon 5115, 256GB DDR4, 32TB SAS存储',
    software_requirements: 'CentOS 7.9, Docker, K8s',
    delivery_date: '2026-06-15',
    delivery_address: '北京市海淀区中关村软件园',
    created_at: '2026-05-01T09:00:00Z',
    updated_at: '2026-05-03T14:00:00Z'
  },
  {
    id: 'QUO-20260503-002',
    project_name: '阿里云GPU训练服务器',
    customer_name: '阿里巴巴云计算有限公司',
    sales_user_id: 2,
    sales_user_name: 'sales01',
    bom_items: [
      { id: 'bom-6', component_type: 'cpu', component_type_label: 'CPU', model: 'Intel Xeon 6248', brand: 'Intel', quantity: 2, unit_price_selling: 15000 },
      { id: 'bom-7', component_type: 'gpu', component_type_label: 'GPU', model: 'NVIDIA A100 40GB', brand: 'NVIDIA', quantity: 4, unit_price_selling: 85000 },
      { id: 'bom-8', component_type: 'mem', component_type_label: '内存', model: '三星 64G DDR4', brand: 'Samsung', quantity: 16, unit_price_selling: 2500 }
    ],
    status: QuotationStatus.PROCUREMENT_PRICING,
    valid_until: new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString(),
    is_expired: false,
    needs_testing: true,
    total_cost: 0,
    profit_margin_rate: 0,
    selling_price_total: 0,
    margin_type: MarginApprovalType.NORMAL,
    created_at: '2026-05-03T11:00:00Z',
    updated_at: '2026-05-05T09:00:00Z'
  },
  {
    id: 'QUO-20260428-003',
    project_name: '腾讯游戏服务器集群',
    customer_name: '腾讯科技(深圳)有限公司',
    sales_user_id: 2,
    sales_user_name: 'sales01',
    bom_items: [
      { id: 'bom-9', component_type: 'cpu', component_type_label: 'CPU', model: 'AMD EPYC 7742', brand: 'AMD', quantity: 2, unit_price_selling: 22000 }
    ],
    status: QuotationStatus.DRAFT,
    valid_until: new Date(now.getTime() + 70 * 60 * 60 * 1000).toISOString(),
    is_expired: false,
    needs_testing: false,
    total_cost: 0,
    profit_margin_rate: 0,
    selling_price_total: 0,
    margin_type: MarginApprovalType.NORMAL,
    created_at: '2026-04-28T15:00:00Z',
    updated_at: '2026-04-28T15:00:00Z'
  }
];

export const MOCK_PURCHASE_ORDERS: FinPurchaseOrder[] = [
  {
    id: 'PO-20260502-001',
    quotation_id: 'QUO-20260501-001',
    procurement_user_id: 4,
    procurement_user_name: 'procurement01',
    initial_form_price: 52000,
    payment_terms: '月结30天',
    expected_delivery_date: '2026-06-01',
    express_company: '顺丰速运',
    tracking_number: 'SF1234567890',
    express_status: '运输中',
    arrived_at: undefined,
    arrival_notified: false,
    expected_quantity: 10,
    actual_quantity: undefined,
    quantity_discrepancy: 0,
    frozen_amount: 0,
    status: PurchaseOrderStatus.IN_TRANSIT,
    created_at: '2026-05-02T14:00:00Z',
    updated_at: '2026-05-05T10:00:00Z'
  }
];

export const MOCK_SETTLEMENTS: FinSettlement[] = [
  {
    id: 101,
    quotation_id: 'QUO-20260501-001',
    purchase_order_id: 'PO-20260502-001',
    total_amount: 64000,
    cost_amount: 52000,
    profit_amount: 12000,
    payment_terms: '月结30天',
    payment_type: PaymentType.CREDIT,
    credit_days: 30,
    settlement_start_date: '2026-05-10',
    payment_due_date: '2026-06-10',
    amount_received: 20000,
    amount_pending: 44000,
    last_payment_date: '2026-05-08',
    status: SettlementStatus.PARTIAL_PAID,
    confirmed_by_sales: 2,
    reviewed_by_finance: 3,
    quality_lock: 0,
    created_at: '2026-05-10T10:00:00Z',
    updated_at: '2026-05-10T10:00:00Z'
  },
  {
    id: 102,
    quotation_id: 'QUO-20260501-001',
    purchase_order_id: 'PO-20260502-001',
    total_amount: 64000,
    cost_amount: 52000,
    profit_amount: 12000,
    payment_terms: '货到付款',
    payment_type: PaymentType.CASH,
    credit_days: 0,
    settlement_start_date: '2026-05-05',
    payment_due_date: '2026-05-05',
    amount_received: 0,
    amount_pending: 64000,
    last_payment_date: undefined,
    status: SettlementStatus.OVERDUE,
    quality_lock: 0,
    created_at: '2026-05-05T09:00:00Z',
    updated_at: '2026-05-12T09:00:00Z'
  }
];

export const MOCK_PAYMENT_RECORDS: FinPaymentRecord[] = [
  {
    id: 201,
    settlement_id: 101,
    quotation_id: 'QUO-20260501-001',
    amount: 20000,
    payment_date: '2026-05-08',
    payment_method: '银行转账',
    reference_number: 'TXN-20260508-001',
    confirmed_by_sales: 2,
    reviewed_by_finance: 3,
    finance_reviewed_at: '2026-05-08T15:00:00Z',
    notes: '',
    status: PaymentRecordStatus.APPROVED
  },
  {
    id: 202,
    settlement_id: 101,
    quotation_id: 'QUO-20260501-001',
    amount: 44000,
    payment_date: '2026-06-05',
    payment_method: '银行转账',
    reference_number: 'TXN-20260605-001',
    confirmed_by_sales: 2,
    reviewed_by_finance: undefined,
    finance_reviewed_at: undefined,
    notes: '',
    status: PaymentRecordStatus.PENDING_FINANCE_REVIEW
  }
];

// =============================================================================
// V2.0 MOCK DATA - 增强生产模块
// =============================================================================

export const MOCK_SCAN_TEMPLATES: ScanTemplate[] = [
  {
    id: 'SCAN-TPL-001',
    name: '551C FKF 标准扫码模版',
    model: '551C FKF',
    description: '适用于551C FKF机型的标准扫码配置',
    scan_items: [
      { component_type: 'mb', label: '主板', sn_count: 1, required: true, bom_field_key: 'mb_sn' },
      { component_type: 'cpu', label: 'CPU 1', sn_count: 1, required: true, bom_field_key: 'cpu_sn' },
      { component_type: 'cpu', label: 'CPU 2', sn_count: 1, required: true, bom_field_key: 'cpu_sn_2' },
      { component_type: 'mem', label: '内存', sn_count: 4, required: true, bom_field_key: 'mem_sns' },
      { component_type: 'hdd', label: '硬盘', sn_count: 8, required: true, bom_field_key: 'hdd_sn' },
      { component_type: 'psu', label: '电源笼', sn_count: 1, required: true, bom_field_key: 'psu_cage_sn' },
      { component_type: 'psu', label: '电源模块1', sn_count: 1, required: true, bom_field_key: 'psu_module_1_sn' },
      { component_type: 'psu', label: '电源模块2', sn_count: 1, required: true, bom_field_key: 'psu_module_2_sn' }
    ],
    created_by: 1,
    created_at: '2026-04-01T10:00:00Z',
    updated_at: '2026-04-01T10:00:00Z'
  }
];

export const MOCK_FAULT_RECORDS: FaultRecord[] = [
  {
    id: 1, machine_sn: 'SRV-2023-002', part_name: '内存', part_sn: 'K1CJ00011819B507B6',
    fault_category: FaultCategory.MEM_ERROR, fault_mode: '内存ECC错误频繁',
    severity: 'HIGH', batch_no: 'MEM-BATCH-202301', supplier: '三星半导体',
    operator_id: 1, operator_name: '王树鹏', created_at: '2023-09-02T10:00:00Z'
  },
  {
    id: 2, machine_sn: 'HM217S007647', part_name: '主板', part_sn: '223B20146',
    fault_category: FaultCategory.CAN_NOT_BOOT, fault_mode: 'POST自检失败',
    severity: 'CRITICAL', batch_no: 'MB-BATCH-202301', supplier: 'Supermicro',
    operator_id: 1, operator_name: '王树鹏', created_at: '2023-10-26T09:00:00Z'
  },
  {
    id: 3, machine_sn: 'SN-003', part_name: '电源', part_sn: 'FSE052A0400CGB2201000999',
    fault_category: FaultCategory.PSU_FAILURE, fault_mode: '电源模块输出不稳定',
    severity: 'MEDIUM', batch_no: 'PSU-BATCH-202301', supplier: '康舒科技',
    operator_id: 1, operator_name: '刘鎏', created_at: '2023-08-15T14:00:00Z'
  }
];

export const MOCK_DEFECT_HEATMAP: DefectRateHeatmap[] = [
  { part_name: '内存', batch_no: 'MEM-BATCH-202301', supplier: '三星半导体', total_installed: 120, total_faulty: 5, defect_rate: 4.17, should_lock_settlement: true },
  { part_name: '主板', batch_no: 'MB-BATCH-202301', supplier: 'Supermicro', total_installed: 50, total_faulty: 1, defect_rate: 2.0, should_lock_settlement: false },
  { part_name: '电源', batch_no: 'PSU-BATCH-202301', supplier: '康舒科技', total_installed: 80, total_faulty: 2, defect_rate: 2.5, should_lock_settlement: false }
];

export const MOCK_SOP_DOCUMENTS: SopDocument[] = [
  {
    id: 1, title: 'CPU安装标准操作流程', category: '组装', model: undefined,
    content: `# CPU安装标准操作流程\n\n## 准备工作\n1. 确认防静电手环已佩戴\n2. 确认工作台清洁无杂物\n3. 准备好导热膏和散热器\n\n## 安装步骤\n1. 打开CPU插座拉杆\n2. 对准CPU三角标记与插座三角标记\n3. 轻放CPU，不可用力按压\n4. 关闭拉杆锁定\n5. 涂抹导热膏（米粒大小）\n6. 安装散热器并拧紧螺丝\n\n## 注意事项\n- 不可触摸CPU底部触点\n- 散热器螺丝需对角拧紧\n- 确认风扇电源线已连接`,
    video_url: 'https://example.com/videos/cpu-install.mp4',
    critical_checkpoints: [
      { id: 'cp-1', label: '防静电手环已佩戴', required: true },
      { id: 'cp-2', label: 'CPU标记已对准', required: true },
      { id: 'cp-3', label: '导热膏已涂抹', required: true },
      { id: 'cp-4', label: '散热器螺丝已对角拧紧', required: true },
      { id: 'cp-5', label: '风扇电源线已连接', required: true }
    ],
    attachments: [], sort_order: 1, is_active: true, created_by: 1,
    created_at: '2026-04-01T10:00:00Z', updated_at: '2026-04-01T10:00:00Z'
  },
  {
    id: 2, title: '内存安装标准操作流程', category: '组装', model: undefined,
    content: `# 内存安装标准操作流程\n\n## 安装步骤\n1. 打开内存插槽两端卡扣\n2. 对准内存缺口与插槽凸起\n3. 垂直用力按下直至卡扣自动锁合\n4. 确认卡扣已完全锁紧\n\n## 通道配置\n- 双通道: A1+B1 或 A2+B2\n- 四通道: A1+B1+C1+D1`,
    critical_checkpoints: [
      { id: 'cp-6', label: '内存缺口已对准', required: true },
      { id: 'cp-7', label: '卡扣已完全锁紧', required: true },
      { id: 'cp-8', label: '通道配置正确', required: true }
    ],
    attachments: [], sort_order: 2, is_active: true, created_by: 1,
    created_at: '2026-04-01T10:00:00Z', updated_at: '2026-04-01T10:00:00Z'
  }
];
