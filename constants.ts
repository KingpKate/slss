
import { OrderStatus, UserRole, Permission, QuotationStatus, PurchaseOrderStatus, SettlementStatus, FaultCategory, WorkstationStatus, WorkOrderStatus, MaintenanceType } from "./types";

export const APP_NAME = "SLSS - 服务器全生命周期系统";

export const ROLE_COLORS: Record<string, string> = {
  [UserRole.ADMIN]: "bg-purple-100 text-purple-800",
  [UserRole.MANAGER]: "bg-blue-100 text-blue-800",
  [UserRole.TECHNICIAN]: "bg-green-100 text-green-800",
  [UserRole.PRODUCTION]: "bg-orange-100 text-orange-800",
  [UserRole.SALES]: "bg-rose-100 text-rose-800",
  [UserRole.FINANCE]: "bg-emerald-100 text-emerald-800",
  [UserRole.PROCUREMENT]: "bg-amber-100 text-amber-800",
  [UserRole.PRODUCT]: "bg-teal-100 text-teal-800",
};

export const STATUS_COLORS: Record<string, string> = {
  [OrderStatus.PENDING]: "bg-gray-100 text-gray-800",
  [OrderStatus.ASSIGNED]: "bg-blue-100 text-blue-800",
  [OrderStatus.CHECKING]: "bg-yellow-100 text-yellow-800",
  [OrderStatus.QA_AGING]: "bg-indigo-100 text-indigo-800",
  [OrderStatus.SHIPPED]: "bg-cyan-100 text-cyan-800",
  [OrderStatus.CLOSED]: "bg-slate-800 text-slate-100",
};

export const STATUS_LABELS: Record<string, string> = {
  [OrderStatus.PENDING]: "待处理",
  [OrderStatus.ASSIGNED]: "已分配",
  [OrderStatus.CHECKING]: "检测/维修中",
  [OrderStatus.QA_AGING]: "老化测试",
  [OrderStatus.SHIPPED]: "已发货",
  [OrderStatus.CLOSED]: "已关闭",
};

export const ROLE_LABELS: Record<string, string> = {
  [UserRole.ADMIN]: "管理员",
  [UserRole.MANAGER]: "服务经理",
  [UserRole.TECHNICIAN]: "技术工程师",
  [UserRole.PRODUCTION]: "生产专员",
  [UserRole.SALES]: "销售",
  [UserRole.FINANCE]: "财务",
  [UserRole.PROCUREMENT]: "采购",
  [UserRole.PRODUCT]: "产品",
};

export const PERMISSION_LABELS: Record<Permission, string> = {
  'VIEW_DASHBOARD': '查看仪表盘',
  'MANAGE_SYSTEM': '系统高级配置',
  // After Sales
  'VIEW_ORDERS': '查看售后工单',
  'MANAGE_ORDERS': '管理/处理工单',
  'DESIGN_PROCESS': '设计业务流程',
  // Production
  'PROD_ENTRY_ASSEMBLY': '生产录入(组装)',
  'PROD_ENTRY_INSPECT_INIT': '生产录入(初检)',
  'PROD_ENTRY_AGING': '生产录入(老化)',
  'PROD_ENTRY_INSPECT_FINAL': '生产录入(终检)',
  'PROD_REPAIR': '生产维修系统',
  'PROD_QUERY': '生产记录查询',
  // V2.0 Financial
  'FIN_VIEW_QUOTATION': '查看报价单',
  'FIN_CREATE_QUOTATION': '创建报价单',
  'FIN_PRODUCT_REVIEW': '产品评估',
  'FIN_PROCUREMENT_PRICE': '采购定价',
  'FIN_APPROVE_MARGIN': '利润审批(经理)',
  'FIN_INITIATE_PROJECT': '项目立项',
  'FIN_PROCUREMENT_EXECUTE': '采购执行',
  'FIN_BUSINESS_TRACK': '商务追踪',
  'FIN_SETTLEMENT': '财务结算',
  'FIN_PAYMENT_REVIEW': '回款审核',
  'FIN_VIEW_DASHBOARD': '财务数据透视',
  // V2.0 Enhanced Production
  'PROD_MANAGE_SETTINGS': '生产设置',
  'PROD_MANAGE_SCAN_TPL': '管理扫码模版',
  'PROD_SOP_MANAGE': 'SOP管理',
  'PROD_SHIPPING': '物流发货',
  // V3.0 MES Permissions
  'WS_VIEW': '查看工作站',
  'WS_MANAGE': '管理工作站',
  'ROUTING_VIEW': '查看工艺路线',
  'ROUTING_MANAGE': '管理工艺路线',
  'WO_VIEW': '查看工单',
  'WO_MANAGE': '管理工单',
  'WO_SCHEDULE': '生产排程',
  'INSP_VIEW': '查看检验',
  'INSP_EXECUTE': '执行检验',
  'SPC_VIEW': '查看SPC',
};

// V2.0 报价单状态标签
export const QUOTATION_STATUS_LABELS: Record<string, string> = {
  [QuotationStatus.DRAFT]: '草稿',
  [QuotationStatus.SUBMITTED_TO_PRODUCT]: '待产品评估',
  [QuotationStatus.PRODUCT_REVIEWING]: '产品评估中',
  [QuotationStatus.TESTING]: '测试中',
  [QuotationStatus.PROCUREMENT_PRICING]: '采购定价中',
  [QuotationStatus.PRICING_COMPLETED]: '定价完成',
  [QuotationStatus.MARGIN_REVIEW]: '利润审核中',
  [QuotationStatus.MARGIN_REJECTED]: '利润驳回',
  [QuotationStatus.APPROVED]: '审核通过',
  [QuotationStatus.PROJECT_INITIATED]: '已立项',
  [QuotationStatus.ABANDONED]: '已放弃',
  [QuotationStatus.EXPIRED]: '已过期',
};

export const QUOTATION_STATUS_COLORS: Record<string, string> = {
  [QuotationStatus.DRAFT]: 'bg-gray-100 text-gray-800',
  [QuotationStatus.SUBMITTED_TO_PRODUCT]: 'bg-blue-100 text-blue-800',
  [QuotationStatus.PRODUCT_REVIEWING]: 'bg-indigo-100 text-indigo-800',
  [QuotationStatus.TESTING]: 'bg-yellow-100 text-yellow-800',
  [QuotationStatus.PROCUREMENT_PRICING]: 'bg-amber-100 text-amber-800',
  [QuotationStatus.PRICING_COMPLETED]: 'bg-teal-100 text-teal-800',
  [QuotationStatus.MARGIN_REVIEW]: 'bg-orange-100 text-orange-800',
  [QuotationStatus.MARGIN_REJECTED]: 'bg-red-100 text-red-800',
  [QuotationStatus.APPROVED]: 'bg-green-100 text-green-800',
  [QuotationStatus.PROJECT_INITIATED]: 'bg-emerald-100 text-emerald-800',
  [QuotationStatus.ABANDONED]: 'bg-slate-200 text-slate-600',
  [QuotationStatus.EXPIRED]: 'bg-red-200 text-red-900',
};

// V2.0 采购订单状态标签
export const PO_STATUS_LABELS: Record<string, string> = {
  [PurchaseOrderStatus.PENDING]: '待执行',
  [PurchaseOrderStatus.ORDERED]: '已下单',
  [PurchaseOrderStatus.SHIPPED]: '已发货',
  [PurchaseOrderStatus.IN_TRANSIT]: '运输中',
  [PurchaseOrderStatus.ARRIVED]: '已到货',
  [PurchaseOrderStatus.INSPECTED]: '已检验',
  [PurchaseOrderStatus.SETTLEMENT_READY]: '可结算',
};

export const PO_STATUS_COLORS: Record<string, string> = {
  [PurchaseOrderStatus.PENDING]: 'bg-gray-100 text-gray-800',
  [PurchaseOrderStatus.ORDERED]: 'bg-blue-100 text-blue-800',
  [PurchaseOrderStatus.SHIPPED]: 'bg-cyan-100 text-cyan-800',
  [PurchaseOrderStatus.IN_TRANSIT]: 'bg-yellow-100 text-yellow-800',
  [PurchaseOrderStatus.ARRIVED]: 'bg-green-100 text-green-800',
  [PurchaseOrderStatus.INSPECTED]: 'bg-teal-100 text-teal-800',
  [PurchaseOrderStatus.SETTLEMENT_READY]: 'bg-emerald-100 text-emerald-800',
};

// V2.0 结算状态标签
export const SETTLEMENT_STATUS_LABELS: Record<string, string> = {
  [SettlementStatus.PENDING]: '待结算',
  [SettlementStatus.INVOICED]: '已开票',
  [SettlementStatus.PARTIAL_PAID]: '部分回款',
  [SettlementStatus.FULLY_PAID]: '全额回款',
  [SettlementStatus.OVERDUE]: '逾期',
};

export const SETTLEMENT_STATUS_COLORS: Record<string, string> = {
  [SettlementStatus.PENDING]: 'bg-gray-100 text-gray-800',
  [SettlementStatus.INVOICED]: 'bg-blue-100 text-blue-800',
  [SettlementStatus.PARTIAL_PAID]: 'bg-yellow-100 text-yellow-800',
  [SettlementStatus.FULLY_PAID]: 'bg-green-100 text-green-800',
  [SettlementStatus.OVERDUE]: 'bg-red-100 text-red-800',
};

// V2.0 故障类别标签
export const FAULT_CATEGORY_LABELS: Record<string, string> = {
  [FaultCategory.CAN_NOT_BOOT]: '无法开机',
  [FaultCategory.MEM_ERROR]: '内存报错',
  [FaultCategory.PHYSICAL_DAMAGE]: '物理损坏',
  [FaultCategory.DOA]: 'DOA(到货即损)',
  [FaultCategory.DISK_ERROR]: '硬盘故障',
  [FaultCategory.PSU_FAILURE]: '电源故障',
  [FaultCategory.NETWORK_ERROR]: '网络故障',
  [FaultCategory.OVERHEATING]: '过热',
  [FaultCategory.OTHER]: '其他',
};

export const FAULT_CATEGORY_COLORS: Record<string, string> = {
  [FaultCategory.CAN_NOT_BOOT]: 'bg-red-100 text-red-800',
  [FaultCategory.MEM_ERROR]: 'bg-orange-100 text-orange-800',
  [FaultCategory.PHYSICAL_DAMAGE]: 'bg-rose-100 text-rose-800',
  [FaultCategory.DOA]: 'bg-red-200 text-red-900',
  [FaultCategory.DISK_ERROR]: 'bg-amber-100 text-amber-800',
  [FaultCategory.PSU_FAILURE]: 'bg-yellow-100 text-yellow-800',
  [FaultCategory.NETWORK_ERROR]: 'bg-cyan-100 text-cyan-800',
  [FaultCategory.OVERHEATING]: 'bg-orange-200 text-orange-900',
  [FaultCategory.OTHER]: 'bg-gray-100 text-gray-800',
};

// V3.0 工作站状态标签
export const WORKSTATION_STATUS_LABELS: Record<string, string> = {
  [WorkstationStatus.IDLE]: '空闲',
  [WorkstationStatus.RUNNING]: '运行中',
  [WorkstationStatus.MAINTENANCE]: '维护中',
  [WorkstationStatus.OFFLINE]: '离线',
};

export const WORKSTATION_STATUS_COLORS: Record<string, string> = {
  [WorkstationStatus.IDLE]: 'bg-green-100 text-green-800',
  [WorkstationStatus.RUNNING]: 'bg-blue-100 text-blue-800',
  [WorkstationStatus.MAINTENANCE]: 'bg-yellow-100 text-yellow-800',
  [WorkstationStatus.OFFLINE]: 'bg-gray-100 text-gray-800',
};

export const MAINTENANCE_TYPE_LABELS: Record<string, string> = {
  PREVENTIVE: '预防性维护',
  CORRECTIVE: '纠正性维护',
  CALIBRATION: '校准',
};

// V3.0 工单状态标签
export const WORK_ORDER_STATUS_LABELS: Record<string, string> = {
  [WorkOrderStatus.QUEUED]: '排队中',
  [WorkOrderStatus.IN_PROGRESS]: '进行中',
  [WorkOrderStatus.BLOCKED]: '已阻塞',
  [WorkOrderStatus.COMPLETED]: '已完成',
  [WorkOrderStatus.CANCELLED]: '已取消',
};

export const WORK_ORDER_STATUS_COLORS: Record<string, string> = {
  [WorkOrderStatus.QUEUED]: 'bg-gray-100 text-gray-800',
  [WorkOrderStatus.IN_PROGRESS]: 'bg-blue-100 text-blue-800',
  [WorkOrderStatus.BLOCKED]: 'bg-red-100 text-red-800',
  [WorkOrderStatus.COMPLETED]: 'bg-green-100 text-green-800',
  [WorkOrderStatus.CANCELLED]: 'bg-slate-100 text-slate-600',
};

// V3.0 检验类别标签
export const INSPECTION_CATEGORY_LABELS: Record<string, string> = {
  INCOMING: '来料检验',
  IN_PROCESS: '过程检验',
  FINAL: '终检',
  AGING: '老化检验',
};

// V3.0 新消息事件类型 (also update types.ts MessageEventType)
export const V3_MESSAGE_EVENT_LABELS: Record<string, string> = {
  WORK_ORDER_OVERDUE: '工单逾期',
  WORK_ORDER_COMPLETED: '工单完成',
  INSPECTION_FAILED: '检验不合格',
  SPC_OUT_OF_CONTROL: 'SPC失控',
};

// Default production operators (sorted by pinyin)
export const DEFAULT_OPERATORS: string[] = [
  '丁一', '张三', '李四', '王五', '赵六', '陈七'
].sort((a, b) => a.localeCompare(b, 'zh-CN'));
