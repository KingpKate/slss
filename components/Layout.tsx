
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { useTheme } from './ThemeContext';
import { api } from '../services/apiClient';
import { Permission } from '../types';
import { 
  LayoutDashboard, 
  Wrench, 
  ScanLine, 
  Shield, 
  LogOut, 
  Menu,
  Server,
  Database
  ,Briefcase
  ,ShoppingCart
} from 'lucide-react';
import { ROLE_LABELS } from '../constants';

const THEME_BRAND_RGB: Record<string, string> = {
  blue: '37, 99, 235',
  purple: '124, 58, 237',
  green: '5, 150, 105',
  orange: '234, 88, 12',
  slate: '51, 65, 85',
};

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  const { themeConfig } = useTheme();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [companyLogo, setCompanyLogo] = React.useState('');
  const [appName, setAppName] = React.useState('SLSS - 服务器全生命周期系统');

  const applyLogoColor = (src: string) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 48; canvas.height = 48;
      const context = canvas.getContext('2d');
      if (!context) return;
      context.drawImage(image, 0, 0, 48, 48);
      const pixels = context.getImageData(0, 0, 48, 48).data;
      let chosen = { r: 22, g: 163, b: 74, score: -1 };
      for (let index = 0; index < pixels.length; index += 4) {
        const alpha = pixels[index + 3] / 255;
        if (alpha < 0.5) continue;
        const r = pixels[index], g = pixels[index + 1], b = pixels[index + 2];
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        const saturation = max === 0 ? 0 : (max - min) / max;
        const brightness = max / 255;
        const score = saturation * 0.75 + brightness * 0.25;
        if (score > chosen.score) chosen = { r, g, b, score };
      }
      const rgb = `${chosen.r}, ${chosen.g}, ${chosen.b}`;
      const dark = `${Math.round(chosen.r * 0.42)}, ${Math.round(chosen.g * 0.42)}, ${Math.round(chosen.b * 0.42)}`;
      document.documentElement.style.setProperty('--slss-brand-rgb', rgb);
      document.documentElement.style.setProperty('--slss-brand-dark-rgb', dark);
    };
    image.src = src;
  };

  React.useEffect(() => { if (companyLogo) applyLogoColor(companyLogo); }, [companyLogo]);
  React.useEffect(() => {
    if (!user) return;
    api.systemSettings().then((settings: any) => { if (settings?.appName) setAppName(settings.appName); }).catch(() => undefined);
    api.companyLogo().then(result => {
      if (result.value) {
        setCompanyLogo(result.value);
      }
    }).catch(() => undefined);
  }, [user?.username]);
  React.useEffect(() => {
    const onSettingsUpdated = (event: Event) => { const value = (event as CustomEvent<any>).detail; if (value?.appName) setAppName(value.appName); };
    window.addEventListener('slss-system-settings-updated', onSettingsUpdated);
    return () => window.removeEventListener('slss-system-settings-updated', onSettingsUpdated);
  }, []);

  if (!user) return <>{children}</>;

  const NavItem = ({ to, icon: Icon, label, permission }: { to: string; icon: any; label: string; permission: Permission }) => {
    // Check if user has the required permission
    if (!user.permissions.includes(permission)) return null;

    const active = location.pathname === to;
    
    // Dynamic styles based on theme
    const activeClass = `${themeConfig.classes.bgLight} ${themeConfig.classes.text} border-r-4 ${themeConfig.classes.border.replace('border-', 'border-l-').replace('200', '600')}`; // Use border-l-color hack or similar? Tailwind border colors are just border-blue-600.
    // Actually, border-r-4 usually needs a border color. Let's use inline style or map correctly.
    // The `themeConfig.classes.text` usually maps to a color like `text-blue-600`.
    // The active border should match.
    const activeBorderColor = themeConfig.color === 'blue' ? 'border-blue-700' : 
                              themeConfig.color === 'purple' ? 'border-purple-700' :
                              themeConfig.color === 'green' ? 'border-emerald-700' :
                              themeConfig.color === 'orange' ? 'border-orange-700' : 'border-slate-700';

    return (
      <Link
        to={to}
        onClick={() => setSidebarOpen(false)}
        className={`flex items-center px-6 py-3 text-sm font-medium transition-colors ${
          active 
            ? `${themeConfig.classes.bgLight} ${themeConfig.classes.text} border-r-4 ${activeBorderColor}` 
            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
        }`}
      >
        <Icon className="w-5 h-5 mr-3" />
        {label}
      </Link>
    );
  };

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-30 w-64 bg-white border-r border-gray-200 transform transition-transform duration-200 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div style={{ backgroundColor: `rgb(${THEME_BRAND_RGB[themeConfig.color] || THEME_BRAND_RGB.green})` }} className="flex items-center justify-center h-16 border-b border-white/10 text-white transition-colors duration-300">
          <Server className="w-7 h-7 mr-2 text-white/90" />
          <span className="text-lg font-bold tracking-wide">{appName}</span>
        </div>

        <nav className="mt-6">
          <NavItem to="/dashboard" icon={LayoutDashboard} label="数据仪表盘" permission="VIEW_DASHBOARD" />
          
          <NavItem 
            to="/orders" 
            icon={Wrench} 
            label="售后工单管理" 
            permission="VIEW_ORDERS" 
          />
          
          <NavItem 
            to="/production/mes" 
            icon={ScanLine} 
            label="生产 MES 工作台" 
            permission="VIEW_PRODUCTION" 
          />
          <NavItem to="/sales-procurement" icon={Briefcase} label="销售立项" permission="MANAGE_SALES" />
          <NavItem to="/procurement" icon={ShoppingCart} label="采购协同" permission="MANAGE_PROCUREMENT" />
          
          <NavItem 
            to="/admin" 
            icon={Shield} 
            label="系统管理配置" 
            permission="MANAGE_SYSTEM" 
          />
        </nav>

        <div className="absolute bottom-0 w-full border-t border-gray-200 p-4 bg-gray-50">
          <div className="flex items-center mb-4">
            <div className={`w-8 h-8 rounded-full ${themeConfig.classes.bgLight} flex items-center justify-center ${themeConfig.classes.text} font-bold border ${themeConfig.classes.border}`}>
              {user.username[0].toUpperCase()}
            </div>
            <div className="ml-3 overflow-hidden">
              <p className="text-sm font-medium text-gray-700 truncate" title={user.username}>{user.username}</p>
              <p className="text-xs text-gray-500">{ROLE_LABELS[user.role]}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex items-center w-full px-2 py-2 text-sm font-medium text-red-600 rounded-md hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-4 h-4 mr-2" />
            退出登录
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="bg-white border-b border-gray-200 flex items-center px-4 lg:px-6 h-16 justify-between shadow-sm">
           <div className="flex items-center font-bold text-gray-800">
              <Server className={`w-6 h-6 ${themeConfig.classes.text} mr-2`} /> {appName}
           </div>
           <div className="flex items-center gap-3">
             <div title="公司 LOGO（请在系统管理配置中维护）" className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5">
               {companyLogo ? <img src={companyLogo} alt="公司 LOGO" className="h-8 max-w-[120px] object-contain" /> : <span className="flex h-8 items-center gap-1.5 px-1 text-xs font-semibold text-slate-500"><span className="grid h-6 w-6 place-items-center rounded border border-dashed border-slate-400 text-[10px]">LOGO</span>导入公司标识</span>}
             </div>
             <button onClick={() => setSidebarOpen(true)} className="text-gray-500 p-2 rounded hover:bg-gray-100 lg:hidden">
               <Menu className="w-6 h-6" />
             </button>
           </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6 bg-gray-50/50">
          {children}
        </main>
      </div>
    </div>
  );
};
