import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { useTheme } from './ThemeContext';
import { api } from '../services/apiClient';
import { Permission } from '../types';
import {
  Activity, Briefcase, ChevronRight, LayoutDashboard, LogOut, Menu,
  ScanLine, Settings2, ShieldCheck, ShoppingCart, Server, Wrench, X
} from 'lucide-react';
import { ROLE_LABELS } from '../constants';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  const { themeConfig } = useTheme();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [companyLogo, setCompanyLogo] = React.useState('');
  const [appName, setAppName] = React.useState('SLSS · 服务器全生命周期系统');
  const [systemOnline, setSystemOnline] = React.useState(true);

  React.useEffect(() => {
    if (!user) return;
    Promise.all([api.systemSettings(), api.companyLogo()]).then(([settings, logo]) => {
      if ((settings as any)?.appName) setAppName((settings as any).appName);
      if ((logo as any)?.value) setCompanyLogo((logo as any).value);
      setSystemOnline(true);
    }).catch(() => setSystemOnline(false));
  }, [user?.username]);

  React.useEffect(() => {
    const onSettingsUpdated = (event: Event) => {
      const value = (event as CustomEvent<any>).detail;
      if (value?.appName) setAppName(value.appName);
      if (value?.logo) setCompanyLogo(value.logo);
    };
    window.addEventListener('slss-system-settings-updated', onSettingsUpdated);
    return () => window.removeEventListener('slss-system-settings-updated', onSettingsUpdated);
  }, []);

  if (!user) return <>{children}</>;

  const nav = [
    { to: '/dashboard', icon: LayoutDashboard, label: '生产运营总览', permission: 'VIEW_DASHBOARD' as Permission, group: '运营中心' },
    { to: '/production/mes', icon: ScanLine, label: '生产 MES 工作台', permission: 'VIEW_PRODUCTION' as Permission, group: '生产管理' },
    { to: '/orders', icon: Wrench, label: '售后工单管理', permission: 'VIEW_ORDERS' as Permission, group: '服务管理' },
    { to: '/sales-procurement', icon: Briefcase, label: '销售立项', permission: 'MANAGE_SALES' as Permission, group: '协同管理' },
    { to: '/procurement', icon: ShoppingCart, label: '采购协同', permission: 'MANAGE_PROCUREMENT' as Permission, group: '协同管理' },
    { to: '/admin', icon: Settings2, label: '系统管理配置', permission: 'MANAGE_SYSTEM' as Permission, group: '系统设置' },
  ];

  const NavItem = ({ item }: { item: typeof nav[number] }) => {
    if (!user.permissions.includes(item.permission)) return null;
    const active = location.pathname === item.to || (item.to === '/production/mes' && location.pathname.startsWith('/production'));
    const Icon = item.icon;
    return <Link to={item.to} onClick={() => setSidebarOpen(false)} className={`slss-nav-link flex min-h-[44px] items-center gap-3 px-5 py-3 text-sm ${active ? 'slss-nav-link-active' : ''}`}>
      <Icon size={18} strokeWidth={active ? 2.4 : 1.9} aria-hidden="true" />
      <span className="truncate">{item.label}</span>
      {active && <ChevronRight className="ml-auto" size={15} aria-hidden="true" />}
    </Link>;
  };

  return <div className="slss-shell flex">
    {sidebarOpen && <button aria-label="关闭侧栏" className="fixed inset-0 z-20 bg-slate-950/40 lg:hidden" onClick={() => setSidebarOpen(false)} />}
    <aside className={`slss-sidebar fixed inset-y-0 left-0 z-30 flex w-[276px] flex-col transition-transform duration-200 lg:static lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="slss-brand-panel min-h-[112px] px-5 py-5 text-white">
        <div className="flex items-center gap-3">
          <div className="slss-brand-mark grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl">
            {companyLogo ? <img src={companyLogo} alt="公司 LOGO" className="h-full w-full object-contain" /> : <Server size={22} aria-hidden="true" />}
          </div>
          <div className="min-w-0"><p className="slss-brand-kicker">SLSS · MES</p><p className="mt-1 truncate text-sm font-semibold tracking-wide">{appName}</p></div>
        </div>
        <div className="slss-brand-meta mt-4"><span className="slss-brand-line" />OPERATIONS CONSOLE <span className="ml-auto font-mono text-[10px] text-slate-500">2.1</span></div>
        <button aria-label="关闭侧栏" className="ml-auto rounded-lg p-2 text-white/70 hover:bg-white/10 lg:hidden" onClick={() => setSidebarOpen(false)}><X size={18} /></button>
      </div>
      <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-3 text-[11px] text-slate-500"><span className="slss-status-dot" />系统在线 <span className="ml-auto font-mono text-slate-400">v2.1</span></div>
      <nav className="flex-1 overflow-y-auto py-4">
        {['运营中心', '生产管理', '服务管理', '协同管理', '系统设置'].map(group => <React.Fragment key={group}>
          <p className="px-5 pb-2 pt-3 text-[10px] font-bold uppercase tracking-[.18em] text-slate-400">{group}</p>
          {nav.filter(item => item.group === group).map(item => <NavItem key={item.to} item={item} />)}
        </React.Fragment>)}
      </nav>
      <div className="border-t border-slate-200 bg-slate-50 p-4">
        <div className="mb-3 flex items-center gap-3"><div className="slss-user-avatar grid h-9 w-9 place-items-center rounded-full text-sm font-bold text-white">{user.username.slice(0, 1).toUpperCase()}</div><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-800">{user.username}</p><p className="truncate text-xs text-slate-500">{ROLE_LABELS[user.role] || user.role}</p></div></div>
        <button onClick={logout} className="flex min-h-[42px] w-full items-center gap-2 rounded-lg px-2 text-sm font-semibold text-slate-600 transition hover:bg-white hover:text-red-600"><LogOut size={16} />退出登录</button>
      </div>
    </aside>
    <div className="flex min-w-0 flex-1 flex-col">
      <header className="slss-topbar sticky top-0 z-10 flex min-h-[68px] items-center justify-between gap-4 px-4 lg:px-8">
        <div className="flex min-w-0 items-center gap-3"><button aria-label="打开侧栏" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden" onClick={() => setSidebarOpen(true)}><Menu size={21} /></button><div className="min-w-0"><p className="truncate text-xs font-semibold uppercase tracking-[.16em] text-slate-400">SLSS / Workspace</p><p className="truncate text-base font-bold text-[var(--color-primary)]">{nav.find(item => location.pathname === item.to || (item.to === '/production/mes' && location.pathname.startsWith('/production')))?.label || '系统工作台'}</p></div></div>
        <div className="flex items-center gap-3"><div className={`hidden items-center gap-2 rounded-full border px-3 py-1.5 text-xs md:flex ${systemOnline ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}`}><Activity size={13} />{systemOnline ? 'API 已连接' : 'API 连接异常'}</div>{companyLogo && <img src={companyLogo} alt="公司 LOGO" className="h-8 max-w-[120px] object-contain" />}<ShieldCheck size={19} className="text-slate-400" aria-hidden="true" /></div>
      </header>
      <main className="slss-page flex-1 overflow-y-auto p-4 lg:p-7">{children}</main>
    </div>
  </div>;
};
