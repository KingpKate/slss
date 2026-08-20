
import { OrderStatus, UserRole, Permission } from "./types";

export const APP_NAME = "SLSS - 服务器全生命周期系统";

export const ROLE_COLORS = {
  [UserRole.ADMIN]: "bg-purple-100 text-purple-800",
  [UserRole.MANAGER]: "bg-blue-100 text-blue-800",
  [UserRole.TECHNICIAN]: "bg-green-100 text-green-800",
  [UserRole.PRODUCTION]: "bg-orange-100 text-orange-800",
};

export const STATUS_COLORS = {
  [OrderStatus.PENDING]: "bg-gray-100 text-gray-800",
  [OrderStatus.ASSIGNED]: "bg-blue-100 text-blue-800",
  [OrderStatus.CHECKING]: "bg-yellow-100 text-yellow-800",
  [OrderStatus.QA_AGING]: "bg-indigo-100 text-indigo-800",
  [OrderStatus.SHIPPED]: "bg-cyan-100 text-cyan-800",
  [OrderStatus.CLOSED]: "bg-slate-800 text-slate-100",
  [OrderStatus.SUSPENDED]: "bg-amber-100 text-amber-800",
  [OrderStatus.CANCELLED]: "bg-red-100 text-red-800",
};

// Chinese Translations for Display
export const STATUS_LABELS = {
  [OrderStatus.PENDING]: "待处理",
  [OrderStatus.ASSIGNED]: "已分配",
  [OrderStatus.CHECKING]: "检测/维修中",
  [OrderStatus.QA_AGING]: "老化测试",
  [OrderStatus.SHIPPED]: "已发货",
  [OrderStatus.CLOSED]: "已关闭",
  [OrderStatus.SUSPENDED]: "已挂起",
  [OrderStatus.CANCELLED]: "已取消",
};

export const ROLE_LABELS = {
  [UserRole.ADMIN]: "管理员",
  [UserRole.MANAGER]: "服务经理",
  [UserRole.TECHNICIAN]: "技术工程师",
  [UserRole.PRODUCTION]: "生产专员",
};

export const PERMISSION_LABELS: Record<Permission, string> = {
  'VIEW_DASHBOARD': '查看仪表盘',
  'VIEW_ORDERS': '查看工单列表',
  'MANAGE_ORDERS': '管理/处理工单',
  'VIEW_PRODUCTION': '查看生产数据 (ERP)',
  'MANAGE_PRODUCTION': '录入/导入生产数据',
  'CREATE_SCAN_TABLE': '创建扫码表',
  'DELETE_SCAN_TABLE': '删除扫码表',
  'MANAGE_SCAN_TEMPLATE': '生产模板配置',
  'USE_SCAN_TEMPLATE': '使用生产扫码模板',
  'ADD_PRODUCTION_COLUMN': '生产录入新增列',
  'DELETE_PRODUCTION_COLUMN': '删除扫码表列',
  'FORCE_DUPLICATE_SN': '强制重复使用 SN',
  'FORCE_EDIT_COMPLETED_SCAN': '强制修改完工扫码数据',
  'FORCE_COMPLETE_SCAN': '强制完工未完成设备',
  'MANAGE_PRODUCTION_REPAIR': '生产维修',
  'MANAGE_SYSTEM': '系统高级配置',
  'VIEW_PERFORMANCE': '查看绩效评价',
  'MANAGE_PERFORMANCE': '绩效模板与评价管理'
  ,'MANAGE_SALES': '销售立项管理'
  ,'MANAGE_PROCUREMENT': '采购项目管理'
};
