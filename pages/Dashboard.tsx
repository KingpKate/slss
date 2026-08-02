import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTheme } from '../components/ThemeContext';
import { api } from '../services/apiClient';
import { analyzeFault } from '../services/aiService';
import {
  Activity, AlertOctagon, AlertTriangle, ArrowUpRight, BrainCircuit, Clock3,
  Cpu, Gauge, RefreshCw, ShieldAlert, Truck, Users, Wrench, ChevronRight
} from 'lucide-react';
import { BarChart, Bar, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const chartColors = ['#23d5ab', '#4f8cff', '#ffc857', '#ff6b6b', '#9b8cff', '#73d2de'];

const Dashboard: React.FC = () => {
  const { themeConfig } = useTheme();
  const navigate = useNavigate();
  const [summary, setSummary] = useState<any>(null);
  const [statistics, setStatistics] = useState<any>(null);
  const [alerts, setAlerts] = useState<{ overdue: any[]; recurring: any[] }>({ overdue: [], recurring: [] });
  const [production, setProduction] = useState<any>({ customers: [], completed: 0, unfinished: 0, repair: 0 });
  const [error, setError] = useState<string | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [detailType, setDetailType] = useState<'completed' | 'unfinished' | 'repair' | 'week-completed' | 'week-unfinished' | 'week-repair' | null>(null);
  const [displayMode, setDisplayMode] = useState<'standard' | 'large'>(() => {
    try { return localStorage.getItem('slss_dashboard_mode') === 'large' ? 'large' : 'standard'; } catch { return 'standard'; }
  });
  const dashboardRef = useRef<HTMLDivElement>(null);

  const switchDisplayMode = (mode: 'standard' | 'large') => {
    setDisplayMode(mode);
    try { localStorage.setItem('slss_dashboard_mode', mode); } catch { /* private browsing */ }
  };

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await dashboardRef.current?.requestFullscreen();
    } catch { /* 浏览器不支持全屏时仍可使用大屏布局 */ }
  };

  const refreshDashboard = async (silent = false) => {
    if (!silent) setRefreshing(true);
    setError(null);
    try {
      const results = await Promise.allSettled([
        api.dashboardProduction(), api.dashboardSummary(), api.dashboardStatistics(), api.dashboardAlerts(),
      ]);
      const [productionData, summaryData, statisticsData, alertsData] = results;
      const failures = results.filter(r => r.status === 'rejected') as PromiseRejectedResult[];
      if (productionData.status === 'fulfilled') setProduction(productionData.value);
      if (summaryData.status === 'fulfilled') setSummary(summaryData.value);
      if (statisticsData.status === 'fulfilled') setStatistics(statisticsData.value);
      if (alertsData.status === 'fulfilled') setAlerts(alertsData.value);
      if (failures.length) setError(`部分仪表盘接口加载失败：${failures.map(f => f.reason?.message || '未知错误').join('；')}`);
      else { setError(null); setLastUpdated(new Date()); }
    } catch (err: any) {
      setError(err?.message || '加载仪表盘数据失败');
    } finally {
      if (!silent) setRefreshing(false);
    }
  };

  useEffect(() => {
    refreshDashboard();
    const timer = window.setInterval(() => refreshDashboard(true), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const stats = useMemo(() => {
    if (summary) return {
      total: summary.totalOrders || 0, pending: summary.pending || 0,
      assigned: summary.assigned || 0, checking: summary.checking || 0,
      closed: summary.closed || 0, assets: summary.assets || 0,
    };
    return { total: 0, pending: 0, assigned: 0, checking: 0, closed: 0, assets: 0 };
  }, [summary]);

  const customerData = useMemo(() => {
    return statistics?.customers || [];
  }, [statistics]);

  const componentData = useMemo(() => {
    return statistics?.components || [];
  }, [statistics]);

  const productionCustomerData = useMemo(() => (production.customers || []).map((item: any) => ({
    name: item.customer || item.customerName || '未知客户',
    完工: Number(item.completed || 0),
    未完工: Number(item.unfinished || 0),
    维修: Number(item.repair || 0),
  })).slice(0, 12), [production.customers]);

  const runAIAnalysis = async () => {
    setAnalyzing(true);
    try {
      const prompt = `请分析SLSS运营数据并给出三条可执行建议：总工单${stats.total}，进行中${stats.checking}，逾期${alerts.overdue.length}，重复故障${alerts.recurring.length}，客户TOP${customerData.map(x => `${x.name}:${x.value}`).join(',')}`;
      const result = await analyzeFault(prompt, 'SLSS Dashboard Operations');
      setAiAnalysis(result.recommendation || result.summary || '当前没有可生成的建议。');
    } catch { setAiAnalysis('AI 分析暂不可用，请检查模型服务配置。'); }
    finally { setAnalyzing(false); }
  };

  const Kpi = ({ label, value, hint, icon: Icon, tone }: any) => (
    <div className={`relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.07] p-5 backdrop-blur-sm ${tone}`}>
      <div className="flex items-start justify-between"><div><p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p><p className="mt-3 text-3xl font-semibold tracking-tight text-white">{value}</p></div><div className="rounded-xl bg-white/10 p-2.5 text-white"><Icon size={19}/></div></div>
      <p className="mt-4 text-xs text-slate-400">{hint}</p><div className="absolute -right-8 -bottom-10 h-28 w-28 rounded-full bg-white/[0.04]"/>
    </div>
  );
  const Empty = ({ label }: { label: string }) => <div className="flex h-full min-h-[190px] items-center justify-center text-sm text-slate-400">{label}</div>;
  const detailRows = detailType === 'completed' ? (production.completedDevices || []) : detailType === 'unfinished' ? (production.unfinishedDevices || []) : detailType === 'repair' ? (production.repairDevices || []) : detailType === 'week-completed' ? (production.weekCompletedDevices || []) : detailType === 'week-unfinished' ? (production.weekUnfinishedDevices || []) : (production.weekRepairDevices || []);
  const detailTitle = detailType?.startsWith('week-') ? '本周' : '当天';
  const aggregatedDetailRows = useMemo(() => {
    const grouped = new Map<string, any>();
    detailRows.forEach((row:any) => {
      const key = `${row.customerName || '未知客户'}\u0000${row.model || '未设置型号'}`;
      const item = grouped.get(key) || { customerName: row.customerName || '未知客户', model: row.model || '未设置型号', quantity: 0, parts: [] };
      item.quantity += 1;
      if (detailType?.includes('repair') && row.partName) item.parts.push(`${row.partName}：${row.oldSn || '—'} → ${row.newSn || '—'}`);
      grouped.set(key, item);
    });
    return Array.from(grouped.values());
  }, [detailRows, detailType]);

  return (
    <div ref={dashboardRef} style={{ backgroundColor: 'rgb(var(--slss-brand-dark-rgb, 16, 42, 32))' }} className={`dashboard-root min-h-full space-y-6 p-5 text-emerald-50 md:p-8 ${displayMode === 'large' ? 'dashboard-large min-h-screen' : ''}`}>
      {error && (
        <div className="flex items-center justify-between rounded-2xl border border-red-300/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          <span>仪表盘数据加载失败：{error}</span>
          <button onClick={() => setError(null)} className="underline">关闭</button>
        </div>
      )}
      <section style={{ background: 'linear-gradient(135deg, rgb(var(--slss-brand-rgb, 29, 80, 56)), rgb(var(--slss-brand-dark-rgb, 16, 42, 32)))' }} className="relative overflow-hidden rounded-3xl border border-white/15 p-6 shadow-2xl md:p-8">
        <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-[#55d68a]/15 blur-3xl"/>
        <div className="relative flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div><div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-[#79e2a0]"><span className="h-2 w-2 animate-pulse rounded-full bg-[#55d68a]"/> Production command center</div><h1 className="max-w-2xl text-3xl font-semibold tracking-tight text-white md:text-4xl">生产运营总览</h1><p className="mt-3 max-w-xl text-sm leading-6 text-emerald-100/70">实时汇总生产扫码、完工进度与客户交付数据。</p></div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <div className="flex items-center rounded-xl border border-white/15 bg-black/20 p-1 text-xs">
              <button onClick={() => switchDisplayMode('standard')} className={`rounded-lg px-3 py-2 transition ${displayMode === 'standard' ? 'bg-white/15 text-white' : 'text-slate-400 hover:text-white'}`}>标准模式</button>
              <button onClick={() => switchDisplayMode('large')} className={`rounded-lg px-3 py-2 transition ${displayMode === 'large' ? 'bg-emerald-400/25 text-emerald-100' : 'text-slate-400 hover:text-white'}`}>大屏模式</button>
            </div>
            <button onClick={toggleFullscreen} className="rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-xs text-slate-300 transition hover:bg-white/10">{displayMode === 'large' ? '进入/退出全屏' : '全屏查看'}</button>
            <button onClick={() => refreshDashboard()} disabled={refreshing} className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-xs text-slate-300 transition hover:bg-white/10 disabled:opacity-60"><RefreshCw size={13} className={refreshing ? 'animate-spin' : ''}/>刷新数据</button>
            <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-right"><p className="text-[10px] uppercase tracking-widest text-slate-500">最后同步</p><p className="mt-1 text-sm font-medium text-slate-200">{lastUpdated ? lastUpdated.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '同步中…'}</p></div>
          </div>
        </div>
      </section>

      {displayMode === 'large' && (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="大屏关键指标">
            {[
              { label: '设备总量', value: production.total || stats.assets || 0, color: 'text-cyan-200', icon: Cpu },
              { label: '今日完工', value: production.completed || 0, color: 'text-emerald-300', icon: ShieldAlert },
              { label: '待完工', value: production.unfinished || 0, color: 'text-amber-300', icon: Clock3 },
              { label: '维修设备', value: production.repair || 0, color: 'text-rose-300', icon: Wrench },
            ].map(({ label, value, color, icon: Icon }) => (
              <div key={label} className="rounded-2xl border border-white/15 bg-white/[.06] px-5 py-4 shadow-xl">
                <div className="flex items-center justify-between"><span className="text-xs tracking-[.16em] text-slate-400">{label}</span><Icon size={18} className={color} /></div>
                <p className={`mt-2 text-4xl font-semibold tracking-tight ${color}`}>{value}</p>
                <p className="mt-1 text-[11px] text-slate-500">实时生产数据</p>
              </div>
            ))}
          </section>
          <section className="dashboard-large-grid grid gap-5 xl:grid-cols-2">
          <div className="rounded-2xl border border-white/15 bg-white/[.06] p-5 shadow-xl">
            <div className="mb-3 flex items-center justify-between"><div><h2 className="text-lg font-semibold text-white">客户交付进度</h2><p className="text-xs text-slate-400">按客户汇总当前完工、未完工与维修设备</p></div><Activity size={20} className="text-emerald-300" /></div>
            <div className="h-[310px]">
              {productionCustomerData.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={productionCustomerData} margin={{ top: 10, right: 12, left: -12, bottom: 8 }}><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.1)" /><XAxis dataKey="name" stroke="#9fb8aa" tick={{ fontSize: 11 }} /><YAxis stroke="#9fb8aa" allowDecimals={false} /><Tooltip contentStyle={{ background: '#102a20', border: '1px solid rgba(255,255,255,.15)', color: '#fff' }} /><Legend /><Bar dataKey="完工" fill="#34d399" radius={[4,4,0,0]} /><Bar dataKey="未完工" fill="#fbbf24" radius={[4,4,0,0]} /><Bar dataKey="维修" fill="#fb7185" radius={[4,4,0,0]} /></BarChart></ResponsiveContainer> : <Empty label="暂无生产统计数据" />}
            </div>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/[.06] p-5 shadow-xl">
            <div className="mb-3 flex items-center justify-between"><div><h2 className="text-lg font-semibold text-white">故障组件分布</h2><p className="text-xs text-slate-400">维修事件按组件类型统计</p></div><Wrench size={20} className="text-rose-300" /></div>
            <div className="h-[310px]">
              {componentData.length ? <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={componentData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={108} label={({ name, percent }) => `${name} ${Math.round((percent || 0) * 100)}%`}>{componentData.map((_: any, index: number) => <Cell key={`component-${index}`} fill={chartColors[index % chartColors.length]} />)}</Pie><Tooltip contentStyle={{ background: '#102a20', border: '1px solid rgba(255,255,255,.15)', color: '#fff' }} /><Legend /></PieChart></ResponsiveContainer> : <Empty label="暂无维修组件数据" />}
            </div>
          </div>
          </section>
        </>
      )}

      <section style={{ backgroundColor: 'rgb(var(--slss-brand-dark-rgb, 18, 53, 38))' }} className="rounded-2xl border border-white/20 p-5">
        <div className="mb-4 flex items-center gap-3 border-b border-white/10 pb-4"><div className="h-8 w-1 rounded-full bg-cyan-300" /><div><h2 className="text-xl font-semibold text-white">生产数据</h2><p className="mt-1 text-xs text-slate-500">当天生产扫码与完工进度</p></div></div>
        <div className="dashboard-kpi-grid grid gap-4 md:grid-cols-3">
          <button onClick={() => setDetailType('completed')} className="text-left"><Kpi label="当天完工" value={production.completed || 0} hint="点击查看完工设备明细" icon={ShieldAlert} tone="border-l-2 border-l-emerald-400" /></button>
          <button onClick={() => setDetailType('unfinished')} className="text-left"><Kpi label="当天未完工" value={production.unfinished || 0} hint="点击查看未完工设备明细" icon={Clock3} tone="border-l-2 border-l-amber-400" /></button>
          <button onClick={() => setDetailType('repair')} className="text-left"><Kpi label="当天维修" value={production.repair || 0} hint="点击查看维修明细" icon={Wrench} tone="border-l-2 border-l-red-400" /></button>
          <button onClick={() => setDetailType('week-completed')} className="text-left"><Kpi label="本周完工" value={production.weekCompleted || 0} hint={`点击查看本周明细：${production.weekStart || '本周一'} 至今天`} icon={ShieldAlert} tone="border-l-2 border-l-emerald-500" /></button>
          <button onClick={() => setDetailType('week-unfinished')} className="text-left"><Kpi label="本周未完工" value={production.weekUnfinished || 0} hint="点击查看本周未完工明细" icon={Clock3} tone="border-l-2 border-l-orange-400" /></button>
          <button onClick={() => setDetailType('week-repair')} className="text-left"><Kpi label="本周维修" value={production.weekRepair || 0} hint="点击查看本周维修明细" icon={Wrench} tone="border-l-2 border-l-red-500" /></button>
        </div>
        {production.customers?.length ? <div className="mt-5 overflow-x-auto rounded-xl border border-white/10"><table className="min-w-full text-sm"><thead className="bg-white/[.04] text-left text-xs text-slate-400"><tr><th className="px-4 py-3">客户</th><th className="px-4 py-3">完工数量</th><th className="px-4 py-3">未完工数量</th><th className="px-4 py-3">维修数量</th></tr></thead><tbody className="divide-y divide-white/10">{production.customers.map((item:any)=><tr key={item.customer} className="text-slate-200"><td className="px-4 py-3 font-medium">{item.customer}</td><td className="px-4 py-3 text-emerald-300">{item.completed}</td><td className="px-4 py-3 text-amber-300">{item.unfinished}</td><td className="px-4 py-3 text-red-300">{item.repair || 0}</td></tr>)}</tbody></table></div> : <div className="mt-5"><Empty label="当天暂无生产扫码数据" /></div>}
      </section>
      {detailType && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setDetailType(null)}>
        <section style={{ backgroundColor: 'rgb(var(--slss-brand-dark-rgb, 18, 53, 38))' }} className="max-h-[85vh] w-full max-w-6xl overflow-auto rounded-2xl p-5 shadow-2xl" onClick={event => event.stopPropagation()}>
          <div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-semibold text-white">{detailTitle}{detailType?.includes('completed') ? '完工设备明细' : detailType?.includes('unfinished') ? '未完工设备明细' : '维修设备明细'}</h2><button onClick={() => setDetailType(null)} className="rounded-lg border border-white/20 px-3 py-1 text-slate-300">关闭</button></div>
          <table className="min-w-full text-sm"><thead className="bg-white/[.06] text-left text-xs text-slate-400"><tr><th className="px-3 py-3">客户名称</th><th className="px-3 py-3">整机型号</th><th className="px-3 py-3">整机数量</th></tr></thead><tbody className="divide-y divide-white/10">{aggregatedDetailRows.map((row:any, index:number) => <tr key={`${row.customerName}-${row.model}-${index}`} className="text-slate-200"><td className="px-3 py-3">{row.customerName}</td><td className="px-3 py-3">{row.model}</td><td className="px-3 py-3 font-semibold text-cyan-300">{row.quantity}</td></tr>)}</tbody></table>
          {!aggregatedDetailRows.length && <Empty label="暂无明细数据" />}
        </section>
      </div>}

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4 text-xs text-slate-500"><span className="flex items-center gap-2"><Truck size={14}/> SLSS Lifecycle Operations</span><span>数据权限由当前登录角色控制 · {themeConfig.name || '标准主题'}</span></footer>
    </div>
  );
};

export default Dashboard;
