
import { OrderStatus, UserRole, Permission, SystemSettings, QuotationStatus, PurchaseOrderStatus, SettlementStatus, FaultCategory } from "./types";

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

// Helper to determine mode dynamically
export const isMockMode = (): boolean => {
  try {
    const settingsStr = localStorage.getItem('slss_system_settings');
    if (settingsStr) {
      const settings: SystemSettings = JSON.parse(settingsStr);
      return settings.systemMode !== 'production';
    }
  } catch (e) {
    console.warn("Failed to parse system settings, defaulting to Demo mode");
  }
  return true;
};

export { isMockMode as MOCK_MODE };
