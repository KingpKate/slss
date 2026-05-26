
import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { useTheme } from './ThemeContext';
import { Permission, ProcessTemplate } from '../types';
import {
  LayoutDashboard, Wrench, ScanLine, LogOut, Menu, Server, Search,
  Hammer, GitMerge, ChevronDown, ChevronRight, Settings, Layers, FileCode,
  DollarSign, ShoppingCart, FileSpreadsheet, CreditCard, BarChart3, Truck, ClipboardList,
  QrCode, Sliders, BookOpen, Activity, Cog, Route, ListChecks, LineChart, ClipboardCheck, BarChart2
} from 'lucide-react';
import { ROLE_LABELS } from '../constants';

// Define Static Menu Structure
const STATIC_MENU_GROUPS = [
  {
    id: 'dashboard',
    title: '概览',
    items: [
      { to: '/dashboard', icon: LayoutDashboard, label: '数据仪表盘', permission: 'VIEW_DASHBOARD' }
    ]
  },
  {
    id: 'service',
    title: '售后服务中心',
    items: [
      { to: '/orders', icon: Wrench, label: '工单管理 (标准)', permission: 'VIEW_ORDERS' }
    ]
  },
  {
    id: 'finance',
    title: '财务管理中心',
    items: [
      { to: '/finance', icon: BarChart3, label: '财务数据透视', permission: 'FIN_VIEW_DASHBOARD' },
      { to: '/finance/quotations', icon: FileSpreadsheet, label: '报价单管理', permission: 'FIN_VIEW_QUOTATION' },
      { to: '/finance/purchase-orders', icon: ShoppingCart, label: '采购订单', permission: 'FIN_PROCUREMENT_EXECUTE' },
      { to: '/finance/settlements', icon: DollarSign, label: '财务结算', permission: 'FIN_SETTLEMENT' },
      { to: '/finance/payments', icon: CreditCard, label: '回款审核', permission: 'FIN_PAYMENT_REVIEW' }
    ]
  },
  {
    id: 'production',
    title: '生产制造中心',
    items: [
      { to: '/production/entry', icon: ScanLine, label: '生产录入', permissions: ['PROD_ENTRY_ASSEMBLY', 'PROD_ENTRY_INSPECT_INIT'] },
      { to: '/production/scan-entry', icon: QrCode, label: '扫码录入', permissions: ['PROD_ENTRY_ASSEMBLY', 'PROD_ENTRY_INSPECT_INIT'] },
      { to: '/production/repair', icon: Hammer, label: '生产维修', permission: 'PROD_REPAIR' },
      { to: '/production/list', icon: Search, label: '记录追溯', permission: 'PROD_QUERY' },
      { to: '/production/shipping', icon: Truck, label: '物流发货', permission: 'PROD_SHIPPING' },
      { to: '/production/quality', icon: Activity, label: '质量画像', permission: 'PROD_QUERY' },
      { to: '/production/scan-templates', icon: ClipboardList, label: '扫码模版', permission: 'PROD_MANAGE_SCAN_TPL' },
      { to: '/production/sop', icon: BookOpen, label: 'SOP管理', permission: 'PROD_SOP_MANAGE' },
      { to: '/production/settings', icon: Sliders, label: '生产设置', permission: 'PROD_MANAGE_SETTINGS' }
    ]
  },
  {
    id: 'mes',
    title: 'MES 生产执行',
    items: [
      { to: '/production/workstations', icon: Cog, label: '工作站管理', permission: 'WS_VIEW' },
      { to: '/production/routings', icon: Route, label: '工艺路线', permission: 'ROUTING_VIEW' },
      { to: '/production/work-orders', icon: ListChecks, label: '生产工单', permission: 'WO_VIEW' },
      { to: '/production/scheduling', icon: BarChart2, label: '生产排程', permission: 'WO_SCHEDULE' },
      { to: '/production/inspections', icon: ClipboardCheck, label: '检验计划', permission: 'INSP_VIEW' },
      { to: '/production/spc', icon: LineChart, label: 'SPC控制图', permission: 'SPC_VIEW' },
    ]
  },
  {
    id: 'workflow',
    title: '自建流程引擎',
    items: [
      { to: '/process-designer', icon: GitMerge, label: '流程设计器', permission: 'MANAGE_SYSTEM' },
    ]
  },
  {
    id: 'system',
    title: '系统管理',
    items: [
      { to: '/admin', icon: Settings, label: '全局配置', permission: 'MANAGE_SYSTEM' }
    ]
  }
];

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  const { themeConfig } = useTheme();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [healthStatus, setHealthStatus] = useState<'ok' | 'error' | 'loading'>('loading');

  // Health check: ping /api/health every 30 seconds
  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();

    const checkHealth = async () => {
      try {
        const res = await fetch('/api/health', {
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(5000)])
        });
        if (mounted) setHealthStatus(res.ok ? 'ok' : 'error');
      } catch {
        if (mounted) setHealthStatus('error');
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => {
      mounted = false;
      controller.abort();
      clearInterval(interval);
    };
  }, []);
  
  // State for collapsible groups (default all open)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    'dashboard': true,
    'service': true,
    'finance': true,
    'production': true,
    'mes': true,
    'workflow': true,
    'system': true
  });

  // State for Dynamic Menu
  const [menuGroups, setMenuGroups] = useState(STATIC_MENU_GROUPS);

  // Fetch templates and build dynamic menu
  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const res = await fetch('/api/templates');
        if (res.ok) {
          const templates: ProcessTemplate[] = await res.json();
          
          // Shallow copy to preserve function components (Icons)
          // JSON.parse(JSON.stringify) destroys functions, causing crash
          const newGroups = STATIC_MENU_GROUPS.map(group => ({
            ...group,
            items: [...group.items]
          }));
          
          // Inject Service Templates
          const serviceTemplates = templates.filter(t => t.targetModule === 'service');
          if (serviceTemplates.length > 0) {
             const serviceGroup = newGroups.find((g: any) => g.id === 'service');
             if (serviceGroup) {
               serviceTemplates.forEach(t => {
                 serviceGroup.items.push({
                    to: `/process/service/${t.id}`,
                    icon: FileCode,
                    label: t.name,
                    permission: 'VIEW_ORDERS' // Reuse existing permission for now
                 });
               });
             }
          }

          // Inject Production Templates
          const prodTemplates = templates.filter(t => t.targetModule === 'production');
          if (prodTemplates.length > 0) {
             const prodGroup = newGroups.find((g: any) => g.id === 'production');
             if (prodGroup) {
               prodTemplates.forEach(t => {
                 prodGroup.items.push({
                    to: `/process/production/${t.id}`,
                    icon: FileCode,
                    label: t.name,
                    permission: 'PROD_QUERY' // Reuse existing permission
                 });
               });
             }
          }
          
          setMenuGroups(newGroups);
        }
      } catch (e) {
        console.error("Failed to load dynamic menu templates", e);
      }
    };
    
    // Initial fetch and optional interval polling (or just refresh on page load)
    fetchTemplates();
  }, [location.pathname]); // Re-fetch when navigating to ensure updates after designing new process

  const toggleGroup = (id: string) => {
    setOpenGroups(prev => ({ ...prev, [id]: !prev[id] }));
  };

  if (!user) return <>{children}</>;

  const NavItem = ({ to, icon: Icon, label, permission, permissions }: any) => {
    const hasAccess = permission 
      ? user.permissions?.includes(permission) 
      : permissions 
        ? permissions.some((p: any) => user.permissions?.includes(p))
        : false;

    if (!hasAccess) return null;

    const active = location.pathname === to;
    const activeColor = themeConfig.classes.text;
    const activeBg = themeConfig.classes.bgLight;
    const activeBorder = themeConfig.color === 'blue' ? 'border-blue-600' : 'border-gray-600';

    // Safety check: if Icon is missing (e.g. bad copy), return null to prevent React Error #130
    if (!Icon) return null;

    return (
      <Link
        to={to}
        onClick={() => setSidebarOpen(false)}
        className={`flex items-center px-4 py-2.5 text-sm font-medium transition-all duration-200 rounded-md ml-4 mb-1
          ${active 
            ? `${activeBg} ${activeColor} border-r-4 ${activeBorder}` 
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
          }`}
      >
        <Icon className={`w-4 h-4 mr-3 ${active ? activeColor : 'text-gray-400'}`} />
        <span className="truncate">{label}</span>
      </Link>
    );
  };

  return (
    <div className="min-h-screen flex bg-gray-50 font-sans">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out flex flex-col shadow-lg lg:shadow-none
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Brand */}
        <div className="flex items-center justify-center h-16 border-b border-gray-200 bg-slate-900 text-white shrink-0">
          <Server className={`w-7 h-7 mr-2 ${themeConfig.classes.text.replace('text-', 'text-').replace('600', '400')}`} />
          <div className="flex flex-col">
             <span className="text-lg font-bold tracking-wide leading-none">SLSS Pro</span>
             <span className="text-[10px] text-gray-400 font-mono tracking-widest mt-1">V2.0.0</span>
             <div className="flex items-center mt-1">
                <span className={`w-1.5 h-1.5 rounded-full mr-1 ${
                  healthStatus === 'ok' ? 'bg-green-400' :
                  healthStatus === 'error' ? 'bg-red-400 animate-pulse' :
                  'bg-gray-400 animate-pulse'
                }`} />
                <span className="text-[9px] text-gray-500">
                  {healthStatus === 'ok' ? '后端已连接' :
                   healthStatus === 'error' ? '后端连接断开' :
                   '检测中...'}
                </span>
             </div>
          </div>
        </div>

        {/* Navigation (Scrollable) */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-2 custom-scrollbar">
          {menuGroups.map(group => (
            <div key={group.id} className="mb-2">
              <button 
                onClick={() => toggleGroup(group.id)}
                className="w-full flex items-center justify-between px-3 py-2 text-xs font-bold text-gray-500 uppercase tracking-wider hover:bg-gray-50 rounded-md transition-colors"
              >
                <span className="flex items-center">
                   {group.id === 'workflow' ? <Layers className="w-3 h-3 mr-2"/> : null}
                   {group.title}
                </span>
                {openGroups[group.id] ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              </button>
              
              <div className={`overflow-hidden transition-all duration-300 ${openGroups[group.id] ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
                 <div className="mt-1 space-y-0.5">
                    {group.items.map((item: any, idx: number) => (
                       <NavItem key={idx} {...item} />
                    ))}
                 </div>
              </div>
            </div>
          ))}
        </nav>

        {/* User Footer */}
        <div className="shrink-0 border-t border-gray-200 p-4 bg-gray-50/50">
          <div className="flex items-center mb-4 px-2">
            <div className={`w-9 h-9 rounded-full ${themeConfig.classes.bgLight} flex items-center justify-center ${themeConfig.classes.text} font-bold border ${themeConfig.classes.border} shadow-sm`}>
              {user.username[0].toUpperCase()}
            </div>
            <div className="ml-3 overflow-hidden">
              <p className="text-sm font-bold text-gray-800 truncate">{user.username}</p>
              <p className="text-xs text-gray-500 truncate">{ROLE_LABELS[user.role]}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex items-center justify-center w-full px-4 py-2 text-sm font-medium text-red-600 bg-white border border-gray-200 rounded-lg hover:bg-red-50 hover:border-red-200 transition-all shadow-sm"
          >
            <LogOut className="w-4 h-4 mr-2" />
            退出登录
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile Header */}
        <header className="lg:hidden bg-white border-b border-gray-200 flex items-center px-4 h-16 justify-between shadow-sm z-40">
           <div className="flex items-center font-bold text-gray-800">
              <Server className={`w-6 h-6 ${themeConfig.classes.text} mr-2`} /> SLSS Mobile
           </div>
           <button onClick={() => setSidebarOpen(true)} className="text-gray-500 p-2 rounded hover:bg-gray-100 active:bg-gray-200">
             <Menu className="w-6 h-6" />
           </button>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-8 bg-gray-50">
          <div className="max-w-7xl mx-auto">
             {children}
          </div>
        </main>
      </div>
    </div>
  );
};
