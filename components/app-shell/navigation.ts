import type { LucideIcon } from 'lucide-react';
import { Activity, Briefcase, ClipboardCheck, LayoutDashboard, ScanLine, Settings2, ShoppingCart, Wrench, ShieldCheck } from 'lucide-react';
import type { Permission } from '../../types';

export type NavigationItem = {
  to: string;
  label: string;
  group: string;
  icon: LucideIcon;
  permission: Permission;
};

export const NAVIGATION_GROUPS = ['运营中心', '人力管理', '生产管理', '质量管理', '服务管理', '协同管理', '系统设置'] as const;

export const NAVIGATION_ITEMS: NavigationItem[] = [
  { to: '/dashboard', icon: LayoutDashboard, label: '生产运营总览', permission: 'VIEW_DASHBOARD', group: '运营中心' },
  { to: '/hr/performance', icon: ClipboardCheck, label: '主管绩效评价', permission: 'VIEW_PERFORMANCE', group: '人力管理' },
  { to: '/production/mes', icon: ScanLine, label: '生产 MES 工作台', permission: 'VIEW_PRODUCTION', group: '生产管理' },
  { to: '/quality', icon: ShieldCheck, label: '质检工作台', permission: 'VIEW_PRODUCTION', group: '质量管理' },
  { to: '/orders', icon: Wrench, label: '售后工单管理', permission: 'VIEW_ORDERS', group: '服务管理' },
  { to: '/sales-procurement', icon: Briefcase, label: '销售立项', permission: 'MANAGE_SALES', group: '协同管理' },
  { to: '/procurement', icon: ShoppingCart, label: '采购协同', permission: 'MANAGE_PROCUREMENT', group: '协同管理' },
  { to: '/admin', icon: Settings2, label: '系统管理配置', permission: 'MANAGE_SYSTEM', group: '系统设置' },
];

export const SYSTEM_STATUS_ICON = Activity;
