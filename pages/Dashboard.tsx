import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, AlertTriangle, BrainCircuit, CheckCircle2, Clock3, Cpu, Maximize2, RefreshCw, Wrench, X } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useTheme } from '../components/ThemeContext';
import { api } from '../services/apiClient';
import { analyzeFault } from '../services/aiService';
import TemperatureHeatmap from '../components/monitoring/TemperatureHeatmap';
import HardwareTrend from '../components/monitoring/HardwareTrend';
import { createMonitoringIncrement, subscribeMockMonitoring, type TemperaturePoint, type TrendSample } from '../components/monitoring/mockMonitoring';

type DetailType = 'completed' | 'unfinished' | 'repair' | 'week-completed' | 'week-unfinished' | 'week-repair' | null;
const palette = ['#1e40af', '#2563eb', '#059669', '#d97706', '#dc2626', '#7c3aed'];

const Dashboard: React.FC = () => {
  const { themeConfig } = useTheme();
  const rootRef = useRef<HTMLDivElement>(null);
  const [summary, setSummary] = useState<any>({});
  const [production, setProduction] = useState<any>({ customers: [] });
  const [statistics, setStatistics] = useState<any>({ customers: [], components: [] });
  const [alerts, setAlerts] = useState<any>({ overdue: [], recurring: [] });
  const [detailType, setDetailType] = useState<DetailType>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>();
  const [aiText, setAiText] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [largeMode, setLargeMode] = useState(false);
  const initialMonitoring = useMemo(() => createMonitoringIncrement(), []);
  const [temperaturePoints, setTemperaturePoints] = useState<TemperaturePoint[]>(initialMonitoring.heatmap);
  const [trendSamples, setTrendSamples] = useState<TrendSample[]>([initialMonitoring.trend]);
  const [monitoringStream, setMonitoringStream] = useState<'LIVE' | 'MOCK' | 'OFFLINE'>('MOCK');

  const refresh = async (silent = false) => {
    if (!silent) setRefreshing(true);
    setError('');
    const results = await Promise.allSettled([api.dashboardProduction(), api.dashboardSummary(), api.dashboardStatistics(), api.dashboardAlerts()]);
    const [p, s, st, a] = results;
    if (p.status === 'fulfilled') setProduction(p.value || {});
    if (s.status === 'fulfilled') setSummary(s.value || {});
    if (st.status === 'fulfilled') setStatistics(st.value || {});
    if (a.status === 'fulfilled') setAlerts(a.value || {});
    const failures = results.filter(item => item.status === 'rejected') as PromiseRejectedResult[];
    if (failures.length) setError(`部分数据暂不可用：${failures.map(item => item.reason?.message || '接口异常').join('；')}`);
    else setLastUpdated(new Date());
    setRefreshing(false);
  };

  useEffect(() => { refresh(); const timer = window.setInterval(() => refresh(true), 30000); return () => window.clearInterval(timer); }, []);

  useEffect(() => {
    let disposed = false;
    let socket: WebSocket | null = null;
    let stopMock: (() => void) | null = null;
    const applyUpdate = (update: ReturnType<typeof createMonitoringIncrement>) => {
      if (disposed) return;
      setTemperaturePoints(update.heatmap);
      setTrendSamples((current) => [...current, update.trend].slice(-300));
    };
    const startMock = () => {
      if (disposed || stopMock) return;
      setMonitoringStream('MOCK');
      stopMock = subscribeMockMonitoring(applyUpdate, 1000);
    };
    const contextPath = window.location.pathname.split('/').slice(0, 2).join('/');
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    try {
      socket = new WebSocket(`${protocol}//${window.location.host}${contextPath}/api/v1/monitoring/stream`);
      socket.onopen = () => {
        if (stopMock) { stopMock(); stopMock = null; }
        setMonitoringStream('LIVE');
      };
      socket.onmessage = (event) => {
        try {
          const update = JSON.parse(event.data) as ReturnType<typeof createMonitoringIncrement>;
          if (Array.isArray(update.heatmap) && update.trend) applyUpdate(update);
        } catch { /* ignore malformed monitoring frame */ }
      };
      socket.onerror = () => { if (!disposed) startMock(); };
      socket.onclose = () => { if (!disposed) { setMonitoringStream('OFFLINE'); startMock(); } };
    } catch {
      startMock();
    }
    const fallback = window.setTimeout(() => { if (!socket || socket.readyState !== WebSocket.OPEN) startMock(); }, 1500);
    return () => {
      disposed = true;
      window.clearTimeout(fallback);
      stopMock?.();
      socket?.close();
    };
  }, []);

  const stats = {
    devices: Number(production.total || summary.assets || 0),
    completed: Number(production.completed || 0),
    unfinished: Number(production.unfinished || 0),
    repair: Number(production.repair || 0),
    orders: Number(summary.totalOrders || 0),
  };
  const customers = (production.customers || []).map((item: any) => ({ name: item.customer || item.customerName || '未命名客户', 完工: Number(item.completed || 0), 未完工: Number(item.unfinished || 0), 维修: Number(item.repair || 0) })).slice(0, 12);
  const detailRows = detailType === 'completed' ? production.completedDevices : detailType === 'unfinished' ? production.unfinishedDevices : detailType === 'repair' ? production.repairDevices : detailType === 'week-completed' ? production.weekCompletedDevices : detailType === 'week-unfinished' ? production.weekUnfinishedDevices : production.weekRepairDevices;
  const detailGroups = useMemo(() => { const grouped = new Map<string, any>(); (detailRows || []).forEach((item: any) => { const customer = item.customerName || '未知客户'; const model = item.model || '未设置型号'; const key = `${customer}-${model}`; const current = grouped.get(key) || { customer, model, quantity: 0 }; current.quantity += 1; grouped.set(key, current); }); return [...grouped.values()]; }, [detailRows]);

  const runAI = async () => {
    setAnalyzing(true);
    try { const result = await analyzeFault(`生产设备${stats.devices}台，今日完工${stats.completed}台，待完工${stats.unfinished}台，逾期工单${alerts.overdue?.length || 0}条。请给出三条可执行运营建议。`, 'SLSS Operations'); setAiText(result.recommendation || result.summary || '暂无建议。'); }
    catch { setAiText('AI 分析暂不可用，请检查后端模型配置。'); }
    finally { setAnalyzing(false); }
  };
  const toggleFullscreen = async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else await rootRef.current?.requestFullscreen(); } catch { /* browser policy */ } };

  const Metric = ({ label, value, hint, icon: Icon, tone = 'text-[var(--color-primary)]', onClick }: any) => <button type="button" onClick={onClick} className="slss-kpi slss-card-hover w-full text-left"><div className="flex items-start justify-between gap-3"><div><p className="slss-kpi-label">{label}</p><p className={`slss-kpi-value mt-3 ${tone}`}>{value}</p></div><span className="theme-accent-soft rounded-xl border p-2.5"><Icon size={18} /></span></div><p className="mt-4 text-xs text-slate-500">{hint}</p></button>;

  return <div ref={rootRef} className={`dashboard-root w-full min-w-0 space-y-5 overflow-visible p-1 md:p-3 ${largeMode ? 'dashboard-large' : ''}`}>
    {error && <div role="alert" className="flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><span><AlertTriangle className="mr-2 inline" size={16} />{error}</span><button type="button" aria-label="关闭错误提示" onClick={() => setError('')}><X size={16} /></button></div>}
    <header className="dashboard-hero slss-card overflow-hidden border-0 p-5 text-white shadow-lg md:p-7"><div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between"><div><div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[.18em] text-emerald-300"><span className="slss-status-dot" />Live operations</div><h1 className="text-3xl font-bold tracking-tight md:text-4xl">生产运营总览</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-200">生产、交付和维修数据集中呈现，快速识别今天需要处理的事项。</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => setLargeMode(value => !value)} className="slss-btn-secondary border-white/20 bg-white/10 text-white hover:bg-white/20">{largeMode ? '标准视图' : '大屏视图'}</button><button type="button" onClick={toggleFullscreen} className="slss-btn-secondary border-white/20 bg-white/10 text-white hover:bg-white/20"><Maximize2 size={15} />全屏</button><button type="button" onClick={() => refresh()} disabled={refreshing} className="slss-btn-secondary border-white/20 bg-white/10 text-white hover:bg-white/20"><RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />刷新</button></div></div><div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-white/15 pt-4 text-xs text-slate-300"><span>主题：{themeConfig.name}</span><span>最后同步：{lastUpdated ? lastUpdated.toLocaleTimeString('zh-CN') : '同步中…'}</span></div></header>
    <section className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-5"><Metric label="生产设备" value={stats.devices} hint="当前扫码表设备总量" icon={Cpu} /><Metric label="今日完工" value={stats.completed} hint="查看完工明细" tone="text-emerald-700" icon={CheckCircle2} onClick={() => setDetailType('completed')} /><Metric label="待完工" value={stats.unfinished} hint="查看未完工明细" tone="text-amber-700" icon={Clock3} onClick={() => setDetailType('unfinished')} /><Metric label="维修设备" value={stats.repair} hint="查看维修明细" tone="text-red-700" icon={Wrench} onClick={() => setDetailType('repair')} /><Metric label="服务工单" value={stats.orders} hint={`待处理 ${summary.pending || 0} · 处理中 ${summary.checking || 0}`} icon={Activity} /></section>
    <section className={`slss-card min-w-0 p-5 ${largeMode ? 'dashboard-monitoring-large' : ''}`} aria-label="设备实时监控与健康看板"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><div className="flex items-center gap-2"><span className={`slss-status-dot ${monitoringStream === 'LIVE' ? '' : 'opacity-50'}`} /><h2 className="slss-section-title text-lg font-bold">设备实时监控与健康看板</h2></div><p className="mt-1 text-xs text-slate-500">8 卡 NPU 集群温度、功耗与风扇转速实时观测</p></div><span className={`rounded-full border px-3 py-1 text-xs font-bold ${monitoringStream === 'LIVE' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : monitoringStream === 'MOCK' ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>{monitoringStream === 'LIVE' ? '实时 WebSocket' : monitoringStream === 'MOCK' ? '本地压测数据' : '连接中'}</span></div><div className="grid min-w-0 gap-5 xl:grid-cols-2"><article className="min-w-0 rounded-xl border border-[var(--color-border)] bg-slate-950/[.02] p-3"><div className="mb-2 text-xs font-bold tracking-[.12em] text-[var(--theme-primary)]">CORE TEMPERATURE MATRIX</div><TemperatureHeatmap points={temperaturePoints} height={largeMode ? 360 : 300} /></article><article className="min-w-0 rounded-xl border border-[var(--color-border)] bg-slate-950/[.02] p-3"><div className="mb-2 text-xs font-bold tracking-[.12em] text-[var(--theme-primary)]">POWER & FAN TELEMETRY</div><HardwareTrend samples={trendSamples} height={largeMode ? 360 : 300} /></article></div></section>
    <section className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]"><article className="slss-card min-w-0 p-5"><div className="mb-4 flex items-start justify-between"><div><h2 className="slss-section-title text-lg font-bold">客户交付进度</h2><p className="mt-1 text-xs text-slate-500">完工、未完工与维修设备按客户汇总</p></div><Activity className="text-[var(--color-secondary)]" size={20} /></div><div className="h-[280px] min-w-0">{customers.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={customers} margin={{ top: 8, right: 10, left: -18, bottom: 8 }}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} /><Tooltip /><Legend /><Bar dataKey="完工" fill="#059669" radius={[4, 4, 0, 0]} /><Bar dataKey="未完工" fill="#d97706" radius={[4, 4, 0, 0]} /><Bar dataKey="维修" fill="#dc2626" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer> : <div className="grid h-full place-items-center text-sm text-slate-500">暂无生产统计数据</div>}</div></article><article className="slss-card min-w-0 p-5"><div className="mb-4 flex items-start justify-between"><div><h2 className="slss-section-title text-lg font-bold">故障组件分布</h2><p className="mt-1 text-xs text-slate-500">维修事件按组件类型统计</p></div><Wrench className="text-red-600" size={20} /></div><div className="h-[280px] min-w-0">{(statistics.components || []).length ? <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={statistics.components} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={92} label={({ name, percent }) => `${name} ${Math.round((percent || 0) * 100)}%`}>{statistics.components.map((_: any, index: number) => <Cell key={index} fill={palette[index % palette.length]} />)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer> : <div className="grid h-full place-items-center text-sm text-slate-500">暂无维修组件数据</div>}</div></article></section>
    <section className="slss-card min-w-0 p-5"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="slss-section-title text-lg font-bold">生产数据</h2><p className="mt-1 text-xs text-slate-500">按日、按周查看生产交付结果</p></div><div className="flex flex-wrap gap-2"><button type="button" className="slss-btn-secondary" onClick={() => setDetailType('week-completed')}>本周完工</button><button type="button" className="slss-btn-secondary" onClick={() => setDetailType('week-unfinished')}>本周未完工</button><button type="button" className="slss-btn-secondary" onClick={() => setDetailType('week-repair')}>本周维修</button></div></div><div className="w-full overflow-x-auto"><table className="slss-table"><thead><tr><th>客户</th><th>完工数量</th><th>未完工数量</th><th>维修数量</th></tr></thead><tbody>{(production.customers || []).map((item: any) => <tr key={item.customer || item.customerName}><td className="font-semibold text-slate-800">{item.customer || item.customerName || '未知客户'}</td><td className="font-mono text-emerald-700">{item.completed || 0}</td><td className="font-mono text-amber-700">{item.unfinished || 0}</td><td className="font-mono text-red-700">{item.repair || 0}</td></tr>)}</tbody></table>{!production.customers?.length && <div className="p-10 text-center text-sm text-slate-500">暂无生产数据</div>}</div></section>
    <section className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]"><article className="slss-card p-5"><div className="flex items-center justify-between"><div><h2 className="slss-section-title text-lg font-bold">服务风险信号</h2><p className="mt-1 text-xs text-slate-500">逾期与重复故障需要优先处理</p></div><AlertTriangle className="text-amber-600" size={20} /></div><div className="mt-5 grid grid-cols-2 gap-3"><div className="rounded-xl bg-amber-50 p-4"><p className="text-xs font-bold text-amber-700">SLA 逾期</p><p className="mt-2 font-mono text-3xl font-bold text-amber-900">{alerts.overdue?.length || 0}</p></div><div className="rounded-xl bg-red-50 p-4"><p className="text-xs font-bold text-red-700">重复故障</p><p className="mt-2 font-mono text-3xl font-bold text-red-900">{alerts.recurring?.length || 0}</p></div></div></article><article className="slss-card p-5"><div className="flex items-center justify-between"><div><h2 className="slss-section-title text-lg font-bold">AI 运营建议</h2><p className="mt-1 text-xs text-slate-500">基于当前后端统计快照生成</p></div><BrainCircuit className="text-[var(--color-secondary)]" size={20} /></div><button type="button" onClick={runAI} disabled={analyzing} className="slss-btn-primary mt-4 w-full"><BrainCircuit size={15} />{analyzing ? '分析中…' : '生成建议'}</button>{aiText && <p className="mt-4 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-700">{aiText}</p>}</article></section>
    {detailType && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4" onClick={() => setDetailType(null)}><div className="slss-card max-h-[80dvh] w-full max-w-4xl overflow-y-auto p-5" onClick={event => event.stopPropagation()}><div className="mb-4 flex items-center justify-between"><h2 className="slss-section-title text-xl font-bold">{detailType.startsWith('week-') ? '本周' : '今日'}{detailType.includes('completed') ? '完工' : detailType.includes('unfinished') ? '未完工' : '维修'}明细</h2><button type="button" aria-label="关闭明细" onClick={() => setDetailType(null)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={18} /></button></div><table className="slss-table"><thead><tr><th>客户名称</th><th>整机型号</th><th>整机数量</th></tr></thead><tbody>{detailGroups.map((item: any) => <tr key={`${item.customer}-${item.model}`}><td>{item.customer}</td><td>{item.model}</td><td className="font-mono font-bold text-[var(--color-secondary)]">{item.quantity}</td></tr>)}</tbody></table>{!detailGroups.length && <div className="p-10 text-center text-sm text-slate-500">暂无明细数据</div>}</div></div>}
    <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-4 text-xs text-slate-500"><span>SLSS Lifecycle Operations</span><span>数据权限由当前登录角色控制</span></footer>
  </div>;
};

export default Dashboard;
