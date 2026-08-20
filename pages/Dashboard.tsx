import React, { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Activity, AlertTriangle, BrainCircuit, CheckCircle2, Clock3, Cpu, Maximize2, RefreshCw, Wrench, X } from 'lucide-react';
import { useTheme } from '../components/ThemeContext';
import { api } from '../services/apiClient';
import { analyzeFault } from '../services/aiService';
import { DataTable, PageContainer } from '../components/design-system/primitives';
import TemperatureHeatmap from '../components/monitoring/TemperatureHeatmap';
import HardwareTrend from '../components/monitoring/HardwareTrend';
import { type TemperaturePoint, type TrendSample } from '../components/monitoring/types';
const DashboardCharts = lazy(() => import('../components/dashboard/DashboardCharts'));

type DetailType = 'completed' | 'unfinished' | 'repair' | 'week-completed' | 'week-unfinished' | 'week-repair' | null;

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
  const [temperaturePoints] = useState<TemperaturePoint[]>([]);
  const [trendSamples] = useState<TrendSample[]>([]);
  const [monitoringStream] = useState<'LIVE' | 'MOCK' | 'OFFLINE'>('OFFLINE');

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

  const stats = {
    devices: Number(production.total || summary.assets || 0),
    completed: Number(production.completed || 0),
    unfinished: Number(production.unfinished || 0),
    repair: Number(production.repair || 0),
    orders: Number(summary.totalOrders || 0),
  };
  const customers = (production.customers || []).map((item: any) => ({ name: item.customer || item.customerName || '未命名客户', 完工: Number(item.completed || 0), 未完工: Number(item.unfinished || 0), 维修: Number(item.repair || 0) })).slice(0, 12);
  const detailRows = detailType === 'completed' ? production.completedDevices : detailType === 'unfinished' ? production.unfinishedDevices : detailType === 'repair' ? production.repairDevices : detailType === 'week-completed' ? production.weekCompletedDevices : detailType === 'week-unfinished' ? production.weekUnfinishedDevices : production.weekRepairDevices;
  const detailGroups = useMemo(() => { const grouped = new Map<string, any>(); (detailRows || []).forEach((item: any) => { const customer = item.customerName || '未知客户'; const model = item.model || '未设置型号'; const key = `${customer}-${model}`; const current = grouped.get(key) || { customer, model, quantity: 0 }; current.quantity += Number(item.quantity || 1); grouped.set(key, current); }); return [...grouped.values()]; }, [detailRows]);

  const runAI = async () => {
    setAnalyzing(true);
    try { const result = await analyzeFault(`生产设备${stats.devices}台，今日完工${stats.completed}台，待完工${stats.unfinished}台，逾期工单${alerts.overdue?.length || 0}条。请给出三条可执行运营建议。`, 'SLSS Operations'); setAiText(result.recommendation || result.summary || '暂无建议。'); }
    catch { setAiText('AI 分析暂不可用，请检查后端模型配置。'); }
    finally { setAnalyzing(false); }
  };
  const toggleFullscreen = async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else await rootRef.current?.requestFullscreen(); } catch { /* browser policy */ } };

  const Metric = ({ label, value, hint, icon: Icon, tone = 'text-[var(--color-primary)]', onClick }: any) => <button type="button" onClick={onClick} className="slss-kpi slss-card-hover w-full text-left"><div className="flex items-start justify-between gap-3"><div><p className="slss-kpi-label">{label}</p><p className={`slss-kpi-value mt-3 ${tone}`}>{value}</p></div><span className="theme-accent-soft rounded-xl border p-2.5"><Icon size={18} /></span></div><p className="mt-4 text-xs text-slate-500">{hint}</p></button>;

  return <PageContainer ref={rootRef} className={`dashboard-root w-full min-w-0 space-y-5 overflow-visible p-1 md:p-3 ${largeMode ? 'dashboard-large' : ''}`}>
    {error && <div role="alert" className="flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><span><AlertTriangle className="mr-2 inline" size={16} />{error}</span><button type="button" aria-label="关闭错误提示" onClick={() => setError('')}><X size={16} /></button></div>}
    <header className="dashboard-hero slss-card overflow-hidden border-0 p-5 text-white shadow-lg md:p-7"><div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between"><div><div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[.18em] text-emerald-300"><span className="slss-status-dot" />Live operations</div><h1 className="text-3xl font-bold tracking-tight md:text-4xl">生产运营总览</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-200">生产、交付和维修数据集中呈现，快速识别今天需要处理的事项。</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => setLargeMode(value => !value)} className="slss-btn-secondary border-white/20 bg-white/10 text-white hover:bg-white/20">{largeMode ? '标准视图' : '大屏视图'}</button><button type="button" onClick={toggleFullscreen} className="slss-btn-secondary border-white/20 bg-white/10 text-white hover:bg-white/20"><Maximize2 size={15} />全屏</button><button type="button" onClick={() => refresh()} disabled={refreshing} className="slss-btn-secondary border-white/20 bg-white/10 text-white hover:bg-white/20"><RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />刷新</button></div></div><div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-white/15 pt-4 text-xs text-slate-300"><span>主题：{themeConfig.name}</span><span>最后同步：{lastUpdated ? lastUpdated.toLocaleTimeString('zh-CN') : '同步中…'}</span></div></header>
    <section className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-5"><Metric label="生产设备" value={stats.devices} hint="当前流程单设备总量" icon={Cpu} /><Metric label="已完工" value={stats.completed} hint="当前已完成设备，查看明细" tone="text-emerald-700" icon={CheckCircle2} onClick={() => setDetailType('completed')} /><Metric label="待完工" value={stats.unfinished} hint="当前未完成设备，查看明细" tone="text-amber-700" icon={Clock3} onClick={() => setDetailType('unfinished')} /><Metric label="维修设备" value={stats.repair} hint="查看维修明细" tone="text-red-700" icon={Wrench} onClick={() => setDetailType('repair')} /><Metric label="服务工单" value={stats.orders} hint={`待处理 ${summary.pending || 0} · 处理中 ${summary.checking || 0}`} icon={Activity} /></section>
    <section className={`slss-card min-w-0 p-5 ${largeMode ? 'dashboard-monitoring-large' : ''}`} aria-label="设备实时监控与健康看板"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><div className="flex items-center gap-2"><span className={`slss-status-dot ${monitoringStream === 'LIVE' ? '' : 'opacity-50'}`} /><h2 className="slss-section-title text-lg font-bold">设备实时监控与健康看板</h2></div><p className="mt-1 text-xs text-slate-500">8 卡 NPU 集群温度、功耗与风扇转速实时观测</p></div><span className={`rounded-full border px-3 py-1 text-xs font-bold ${monitoringStream === 'LIVE' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : monitoringStream === 'MOCK' ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>{monitoringStream === 'LIVE' ? '实时 WebSocket' : monitoringStream === 'MOCK' ? '本地压测数据' : '实时监控不可用'}</span></div>{monitoringStream === 'OFFLINE' && <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800" role="status">实时监控连接不可用，当前未展示模拟数据。</div>}<div className="grid min-w-0 gap-5 xl:grid-cols-2"><article className="min-w-0 rounded-xl border border-[var(--color-border)] bg-slate-950/[.02] p-3"><div className="mb-2 text-xs font-bold tracking-[.12em] text-[var(--theme-primary)]">CORE TEMPERATURE MATRIX</div><TemperatureHeatmap points={temperaturePoints} height={largeMode ? 360 : 300} /></article><article className="min-w-0 rounded-xl border border-[var(--color-border)] bg-slate-950/[.02] p-3"><div className="mb-2 text-xs font-bold tracking-[.12em] text-[var(--theme-primary)]">POWER & FAN TELEMETRY</div><HardwareTrend samples={trendSamples} height={largeMode ? 360 : 300} /></article></div></section>
    <Suspense fallback={<section className="slss-card h-[340px] animate-pulse" aria-label="图表加载中" />}><DashboardCharts customers={customers} components={statistics.components || []} /></Suspense>
    <section className="slss-card min-w-0 p-5"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="slss-section-title text-lg font-bold">生产数据</h2><p className="mt-1 text-xs text-slate-500">按日、按周查看生产交付结果</p></div><div className="flex flex-wrap gap-2"><button type="button" className="slss-btn-secondary" onClick={() => setDetailType('week-completed')}>本周完工</button><button type="button" className="slss-btn-secondary" onClick={() => setDetailType('week-unfinished')}>本周未完工</button><button type="button" className="slss-btn-secondary" onClick={() => setDetailType('week-repair')}>本周维修</button></div></div><DataTable rows={production.customers || []} rowKey={(item: any) => item.customer || item.customerName} columns={[{ key: 'customer', header: '客户', render: (item: any) => <span className="font-semibold">{item.customer || item.customerName || '未知客户'}</span> }, { key: 'completed', header: '完工数量', render: (item: any) => <span className="font-mono text-[var(--status-good)]">{item.completed || 0}</span> }, { key: 'unfinished', header: '未完工数量', render: (item: any) => <span className="font-mono text-[var(--status-warning)]">{item.unfinished || 0}</span> }, { key: 'repair', header: '维修数量', render: (item: any) => <span className="font-mono text-[var(--status-error)]">{item.repair || 0}</span> }]} /></section>
    <section className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]"><article className="slss-card p-5"><div className="flex items-center justify-between"><div><h2 className="slss-section-title text-lg font-bold">服务风险信号</h2><p className="mt-1 text-xs text-slate-500">逾期与重复故障需要优先处理</p></div><AlertTriangle className="text-amber-600" size={20} /></div><div className="mt-5 grid grid-cols-2 gap-3"><div className="rounded-xl bg-amber-50 p-4"><p className="text-xs font-bold text-amber-700">SLA 逾期</p><p className="mt-2 font-mono text-3xl font-bold text-amber-900">{alerts.overdue?.length || 0}</p></div><div className="rounded-xl bg-red-50 p-4"><p className="text-xs font-bold text-red-700">重复故障</p><p className="mt-2 font-mono text-3xl font-bold text-red-900">{alerts.recurring?.length || 0}</p></div></div></article><article className="slss-card p-5"><div className="flex items-center justify-between"><div><h2 className="slss-section-title text-lg font-bold">AI 运营建议</h2><p className="mt-1 text-xs text-slate-500">基于当前后端统计快照生成</p></div><BrainCircuit className="text-[var(--color-secondary)]" size={20} /></div><button type="button" onClick={runAI} disabled={analyzing} className="slss-btn-primary mt-4 w-full"><BrainCircuit size={15} />{analyzing ? '分析中…' : '生成建议'}</button>{aiText && <p className="mt-4 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-700">{aiText}</p>}</article></section>
    {detailType && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4" onClick={() => setDetailType(null)}><div className="slss-card max-h-[80dvh] w-full max-w-4xl overflow-y-auto p-5" onClick={event => event.stopPropagation()}><div className="mb-4 flex items-center justify-between"><h2 className="slss-section-title text-xl font-bold">{detailType.startsWith('week-') ? '本周' : '今日'}{detailType.includes('completed') ? '完工' : detailType.includes('unfinished') ? '未完工' : '维修'}明细</h2><button type="button" aria-label="关闭明细" onClick={() => setDetailType(null)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={18} /></button></div><table className="slss-table"><thead><tr><th>客户名称</th><th>整机型号</th><th>整机数量</th></tr></thead><tbody>{detailGroups.map((item: any) => <tr key={`${item.customer}-${item.model}`}><td>{item.customer}</td><td>{item.model}</td><td className="font-mono font-bold text-[var(--color-secondary)]">{item.quantity}</td></tr>)}</tbody></table>{!detailGroups.length && <div className="p-10 text-center text-sm text-slate-500">暂无明细数据</div>}</div></div>}
    <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-4 text-xs text-slate-500"><span>SLSS Lifecycle Operations</span><span>数据权限由当前登录角色控制</span></footer>
  </PageContainer>;
};

export default Dashboard;
