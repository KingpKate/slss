import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { api } from '../services/apiClient';
import { Permission } from '../types';
import {
  Activity, Briefcase, ChevronRight, LayoutDashboard, LogOut, Menu,
  ScanLine, Settings2, ShieldCheck, ShoppingCart, Server, Wrench, X
} from 'lucide-react';
import { ROLE_LABELS } from '../constants';

const resolveAssetUrl = (value: string) => {
  if (!value || /^(https?:|data:|blob:)/i.test(value)) return value;
  const path = window.location.pathname.replace(/\/index\.html$/, '').replace(/\/$/, '');
  return `${path}${value.startsWith('/') ? value : `/${value}`}` || value;
};

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [companyLogo, setCompanyLogo] = React.useState('');
  const [appName, setAppName] = React.useState('SLSS · 服务器全生命周期系统');
  const [systemOnline, setSystemOnline] = React.useState(true);

  React.useEffect(() => {
    if (!user) return;
    api.branding().then((branding: any) => {
      if (branding?.appName) setAppName(branding.appName);
      if (branding?.logo) setCompanyLogo(resolveAssetUrl(branding.logo));
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

  const activeItem = nav.find(item => location.pathname === item.to || (item.to === '/production/mes' && location.pathname.startsWith('/production')));
  return <div className="slss-shell flex">
    {sidebarOpen && <button aria-label="关闭侧栏" className="slss-backdrop fixed inset-0 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />}
    <aside className={`slss-sidebar fixed inset-y-0 left-0 z-30 flex w-[292px] flex-col transition-transform duration-200 lg:static lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="slss-brand-lockup">
        <div className="slss-logo-safe"><div className="slss-logo-frame">{companyLogo ? <img src={companyLogo} alt="公司 LOGO" /> : <Server size={24} aria-hidden="true" />}</div></div>
        <div className="slss-brand-copy"><p className="slss-brand-kicker">SLSS / MES</p><p className="slss-brand-name">{appName}</p><p className="slss-brand-caption">OPERATIONS CONSOLE · 2.1</p></div>
        <button aria-label="关闭侧栏" className="slss-close-sidebar lg:hidden" onClick={() => setSidebarOpen(false)}><X size={18} /></button>
      </div>
      <div className="slss-connection-strip"><span className={`slss-status-dot ${systemOnline ? '' : 'is-offline'}`} /><span>{systemOnline ? '服务正常运行' : 'API 连接异常'}</span><span className="slss-connection-version">v2.1</span></div>
      <nav className="slss-nav flex-1 overflow-y-auto" aria-label="主导航">
        {['运营中心', '生产管理', '服务管理', '协同管理', '系统设置'].map(group => {
          const items = nav.filter(item => item.group === group && user.permissions.includes(item.permission));
          if (!items.length) return null;
          return <section className="slss-nav-group" key={group}><p className="slss-nav-label">{group}</p>{items.map(item => <NavItem key={item.to} item={item} />)}</section>;
        })}
      </nav>
      <div className="slss-account-panel"><div className="slss-account-row"><div className="slss-user-avatar">{user.username.slice(0, 1).toUpperCase()}</div><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-800">{user.username}</p><p className="truncate text-xs text-slate-500">{ROLE_LABELS[user.role] || user.role}</p></div></div><button onClick={logout} className="slss-logout"><LogOut size={16} />退出登录</button></div>
    </aside>
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <header className="slss-topbar sticky top-0 z-10 flex min-h-[76px] items-center justify-between gap-4 px-4 lg:px-8">
        <div className="flex min-w-0 items-center gap-3"><button aria-label="打开侧栏" className="slss-menu-button lg:hidden" onClick={() => setSidebarOpen(true)}><Menu size={21} /></button><div className="min-w-0"><p className="slss-breadcrumb">WORKSPACE <span>/</span> {activeItem?.group || 'OPERATIONS'}</p><p className="slss-page-title truncate">{activeItem?.label || '系统工作台'}</p></div></div>
        <div className="slss-topbar-actions"><div className={`slss-api-pill ${systemOnline ? 'is-online' : 'is-offline'}`}><Activity size={14} />{systemOnline ? 'API 已连接' : 'API 连接异常'}</div>{companyLogo && <div className="slss-top-logo"><img src={companyLogo} alt="公司 LOGO" /></div>}<ShieldCheck size={19} className="text-slate-400" aria-hidden="true" /></div>
      </header>
      <main className="slss-page min-h-0 flex-1 p-4 lg:p-7">{children}</main>
    </div>
  </div>;
};
