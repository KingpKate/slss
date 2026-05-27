import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../components/AuthContext';
import { ProductionDashboardData, FinanceDashboardSummary, DefectRateBatchLock, CapacityInfo } from '../types';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  Activity, Cpu, ClipboardCheck, Truck, FileText, BrainCircuit, RefreshCw, ChevronRight,
  AlertTriangle, AlertOctagon, Clock, CheckCircle, Package, TrendingUp, Zap, Users, ShieldAlert, Lock,
} from 'lucide-react';
import { PageHeader, LoadingSpinner, StatCard, StatusBadge, Alert } from '../components/ui';
import { WORK_ORDER_STATUS_LABELS } from '../constants';
import { WorkOrderStatus } from '../types';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#6366f1'];

const WO_BADGE_COLORS: Record<WorkOrderStatus, 'blue' | 'yellow' | 'red' | 'green' | 'gray'> = {
  QUEUED: 'blue', IN_PROGRESS: 'yellow', BLOCKED: 'red', COMPLETED: 'green', CANCELLED: 'gray',
};

const WS_STATUS_CONFIG = [
  { label: '空闲', key: 'idle', color: '#22c55e' },
  { label: '运行中', key: 'running', color: '#f59e0b' },
  { label: '维护中', key: 'maintenance', color: '#f97316' },
  { label: '离线', key: 'offline', color: '#ef4444' },
];

const QUICK_LINKS = [
  { label: '生产工单', desc: '工单创建与管理', href: '/production/work-orders', color: 'blue' },
  { label: '工站管理', desc: '工作站状态与维护', href: '/production/workstations', color: 'green' },
  { label: '排程看板', desc: '自动排程与日历', href: '/production/scheduling', color: 'purple' },
  { label: '质量画像', desc: '不良率与批次锁定', href: '/production/quality', color: 'red' },
  { label: 'SPC 控制图', desc: '过程能力分析', href: '/production/spc', color: 'orange' },
  { label: 'SOP 管理', desc: '标准作业程序', href: '/production/sop', color: 'cyan' },
  { label: '物流发货', desc: '发货跟踪与结算', href: '/production/shipping', color: 'yellow' },
  { label: '生产设置', desc: 'MES 参数配置', href: '/production/settings', color: 'gray' },
];

const LINK_COLORS: Record<string, { border: string; bg: string; text: string }> = {
  blue:   { border: 'hover:border-blue-300',   bg: 'hover:bg-blue-50',   text: 'text-blue-600' },
  green:  { border: 'hover:border-green-300',  bg: 'hover:bg-green-50',  text: 'text-green-600' },
  purple: { border: 'hover:border-purple-300', bg: 'hover:bg-purple-50', text: 'text-purple-600' },
  red:    { border: 'hover:border-red-300',    bg: 'hover:bg-red-50',    text: 'text-red-600' },
  orange: { border: 'hover:border-orange-300', bg: 'hover:bg-orange-50', text: 'text-orange-600' },
  cyan:   { border: 'hover:border-cyan-300',   bg: 'hover:bg-cyan-50',   text: 'text-cyan-600' },
  yellow: { border: 'hover:border-yellow-300', bg: 'hover:bg-yellow-50', text: 'text-yellow-600' },
  gray:   { border: 'hover:border-gray-300',   bg: 'hover:bg-gray-50',   text: 'text-gray-600' },
};

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [prodData, setProdData] = useState<ProductionDashboardData | null>(null);
  const [finData, setFinData] = useState<FinanceDashboardSummary | null>(null);
  const [capacity, setCapacity] = useState<CapacityInfo[]>([]);
  const [batchLocks, setBatchLocks] = useState<DefectRateBatchLock[]>([]);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [prodRes, finRes, capRes, lockRes] = await Promise.all([
          fetch('/api/production/dashboard'),
          fetch('/api/finance/dashboard'),
          fetch('/api/production/scheduling/capacity'),
          fetch('/api/production/fault-records/batch-lock'),
        ]);
        if (prodRes.ok) setProdData(await prodRes.json());
        if (finRes.ok) setFinData(await finRes.json());
        if (capRes.ok) setCapacity(await capRes.json());
        if (lockRes.ok) setBatchLocks(await lockRes.json());
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  const runAIAnalysis = async () => {
    if (!prodData) return;
    setAnalyzing(true);
    setAiAnalysis(null);
    const { work_orders: wo, quality: q, shipping: s, workstations: ws } = prodData;
    const prompt = `请根据以下MES生产数据进行风险分析并给出管理建议(简短3点):\n- 工单: 总${wo.total}, 排队${wo.queued}, 进行中${wo.in_progress}, 阻塞${wo.blocked}, 完成率${wo.completion_rate}%\n- 工站: 总${ws.total}, 运行${ws.running}, 维护${ws.maintenance}, 离线${ws.offline}, 平均利用率${ws.avg_utilization}%\n- 质量: 检验${q.total_inspections}, 通过率${q.pass_rate}%, 批次锁定${q.batch_locks}, 故障记录${q.fault_count}\n- 物流: 总${s.total}, 运输中${s.in_transit}, 已签收${s.delivered}, 待发结算信号${s.pending_signal}`;
    try {
      const { analyzeFault } = await import('../services/geminiService');
      const result = await analyzeFault(prompt, "MES Dashboard Data");
      setAiAnalysis(result.recommendation || result.summary);
    } catch (e: any) {
      setAiAnalysis(e.message || "AI 服务不可用，请在【系统管理】中配置 API Key。");
    } finally {
      setAnalyzing(false);
    }
  };

  const wsChartData = useMemo(() => {
    if (!prodData) return [];
    return WS_STATUS_CONFIG.map(c => ({
      name: c.label,
      value: (prodData.workstations as any)[c.key] || 0,
      color: c.color,
    }));
  }, [prodData]);

  const formatCurrency = (v: number) => {
    if (v >= 10000) return `${(v / 10000).toFixed(1)}万`;
    return v.toLocaleString('zh-CN', { style: 'currency', currency: 'CNY' });
  };

  if (loading) return <LoadingSpinner />;

  const wo = prodData?.work_orders;
  const ws = prodData?.workstations;
  const q = prodData?.quality;
  const s = prodData?.shipping;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Activity}
        title="MES 运营总览"
        subtitle={`数据统计截止: ${new Date().toLocaleDateString('zh-CN')}`}
      />

      {/* Row 1: Core KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard label="生产工单" value={wo?.total || 0} icon={ClipboardCheck} color="blue" />
        <StatCard label="排队中" value={wo?.queued || 0} icon={Clock} color="yellow" />
        <StatCard label="进行中" value={wo?.in_progress || 0} icon={Zap} color="orange" />
        <StatCard label="已完成" value={wo?.completed || 0} icon={CheckCircle} color="green" />
        <StatCard label="质检通过率" value={`${q?.pass_rate || 0}%`} icon={ShieldAlert} color={q && q.pass_rate >= 90 ? 'green' : 'red'} />
        <StatCard label="运输中" value={s?.in_transit || 0} icon={Truck} color="purple" />
      </div>

      {/* Row 2: Workstation Status + Finance Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-blue-500" /> 工站实时状态
            </h3>
            <span className="text-xs text-gray-500">平均利用率 {ws?.avg_utilization || 0}%</span>
          </div>
          <div className="grid grid-cols-4 gap-3 mb-4">
            {WS_STATUS_CONFIG.map(c => (
              <div key={c.key} className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-gray-900">{(ws as any)?.[c.key] || 0}</p>
                <p className="text-xs text-gray-500 mt-1">{c.label}</p>
              </div>
            ))}
          </div>
          <div className="w-full h-4 bg-gray-100 rounded-full overflow-hidden flex">
            {WS_STATUS_CONFIG.map(c => {
              const val = (ws as any)?.[c.key] || 0;
              const total = ws?.total || 1;
              const pct = (val / total) * 100;
              return pct > 0 ? (
                <div key={c.key} className="h-full transition-all" style={{ width: `${pct}%`, backgroundColor: c.color }} title={`${c.label}: ${val}`} />
              ) : null;
            })}
          </div>
          <div className="flex justify-between mt-2">
            {WS_STATUS_CONFIG.map(c => (
              <span key={c.key} className="flex items-center gap-1 text-[10px] text-gray-500">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} /> {c.label}
              </span>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
          <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-purple-500" /> 财务概览
          </h3>
          {finData ? (
            <div className="space-y-3">
              {[
                { label: '活跃项目', value: finData.active_projects, color: 'text-blue-600' },
                { label: '总收入', value: formatCurrency(finData.total_revenue), color: 'text-green-600' },
                { label: '总利润', value: formatCurrency(finData.total_profit), color: 'text-purple-600' },
                { label: '待收款', value: formatCurrency(finData.total_outstanding), color: 'text-yellow-600' },
                { label: '逾期笔数', value: finData.overdue_count, color: finData.overdue_count > 0 ? 'text-red-600' : 'text-gray-600' },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">{item.label}</span>
                  <span className={`text-sm font-bold ${item.color}`}>{item.value}</span>
                </div>
              ))}
              {finData.overdue_count > 0 && (
                <div className="mt-2 p-2 bg-red-50 rounded-lg border border-red-100">
                  <p className="text-[10px] text-red-600 font-medium">逾期金额: {formatCurrency(finData.overdue_amount)}</p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-gray-400">暂无财务数据</p>
          )}
        </div>
      </div>

      {/* Row 3: Production Board + Quality Board */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Production Board */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-blue-500" /> 最近工单
            </h3>
            <Link to="/production/work-orders" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
              查看全部 <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          {prodData?.recent_work_orders && prodData.recent_work_orders.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {prodData.recent_work_orders.map(wo => (
                <div key={wo.id} className="px-5 py-3 hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => navigate(`/production/work-orders`)}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{wo.machine_sn}</p>
                      <p className="text-[10px] text-gray-500 font-mono">{wo.id} {wo.routing_name ? `· ${wo.routing_name}` : ''}</p>
                    </div>
                    <StatusBadge label={WORK_ORDER_STATUS_LABELS[wo.status]} color={WO_BADGE_COLORS[wo.status]} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-5 py-8 text-center text-gray-400 text-sm">暂无工单数据</div>
          )}
        </div>

        {/* Quality Board */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-500" /> 质量看板
            </h3>
            <Link to="/production/quality" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
              详细报告 <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-lg font-bold text-gray-900">{q?.total_inspections || 0}</p>
                <p className="text-[10px] text-gray-500">总检验</p>
              </div>
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <p className="text-lg font-bold text-green-600">{q?.pass_count || 0}</p>
                <p className="text-[10px] text-gray-500">通过</p>
              </div>
              <div className="text-center p-3 bg-red-50 rounded-lg">
                <p className="text-lg font-bold text-red-600">{q?.fail_count || 0}</p>
                <p className="text-[10px] text-gray-500">不通过</p>
              </div>
            </div>

            {/* Pass rate bar */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-500">通过率</span>
                <span className={`font-bold ${q && q.pass_rate >= 90 ? 'text-green-600' : 'text-red-600'}`}>{q?.pass_rate || 0}%</span>
              </div>
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${q && q.pass_rate >= 90 ? 'bg-green-500' : 'bg-red-500'}`} style={{ width: `${q?.pass_rate || 0}%` }} />
              </div>
            </div>

            {/* Batch locks */}
            {batchLocks.length > 0 && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Lock className="w-3.5 h-3.5 text-red-500" />
                  <span className="text-xs font-bold text-red-800">{batchLocks.length} 个批次被锁定</span>
                </div>
                {batchLocks.slice(0, 3).map((lock, i) => (
                  <p key={i} className="text-[10px] text-red-600 truncate">{lock.batch_no} · {lock.part_name} · {lock.supplier}</p>
                ))}
              </div>
            )}

            {/* Recent faults */}
            {prodData?.recent_faults && prodData.recent_faults.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-700 mb-2">最近故障</p>
                <div className="space-y-1">
                  {prodData.recent_faults.slice(0, 3).map(f => (
                    <div key={f.id} className="flex items-center justify-between text-xs">
                      <span className="text-gray-600 truncate">{f.machine_sn} · {f.part_name}</span>
                      <span className="text-gray-400 shrink-0 ml-2">{f.fault_category}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Row 4: Shipping + AI Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Shipping Overview */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
              <Truck className="w-4 h-4 text-purple-500" /> 物流发货
            </h3>
            <Link to="/production/shipping" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
              查看全部 <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-4 gap-3 mb-4">
              {[
                { label: '总发货', value: s?.total || 0, color: 'bg-blue-50 text-blue-600' },
                { label: '运输中', value: s?.in_transit || 0, color: 'bg-yellow-50 text-yellow-600' },
                { label: '已签收', value: s?.delivered || 0, color: 'bg-green-50 text-green-600' },
                { label: '待发信号', value: s?.pending_signal || 0, color: 'bg-red-50 text-red-600' },
              ].map(item => (
                <div key={item.label} className={`text-center p-3 rounded-lg ${item.color}`}>
                  <p className="text-xl font-bold">{item.value}</p>
                  <p className="text-[10px] mt-1">{item.label}</p>
                </div>
              ))}
            </div>
            {s && s.pending_signal > 0 && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-xs text-yellow-800 font-medium">{s.pending_signal} 条发货记录待发送结算信号</p>
              </div>
            )}
          </div>
        </div>

        {/* AI Analysis */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
              <BrainCircuit className="w-4 h-4 text-indigo-500" /> AI 风险分析
            </h3>
            <button onClick={runAIAnalysis} disabled={analyzing || !prodData}
              className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors">
              {analyzing ? <RefreshCw className="w-3 h-3 mr-1 animate-spin" /> : <BrainCircuit className="w-3 h-3 mr-1" />}
              {analyzing ? '分析中...' : 'AI 分析'}
            </button>
          </div>
          <div className="p-5">
            {aiAnalysis ? (
              <pre className="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed font-sans">{aiAnalysis}</pre>
            ) : (
              <div className="text-center py-6 text-gray-400 text-sm">
                <BrainCircuit className="w-8 h-8 mx-auto mb-2 opacity-20" />
                <p>点击「AI 分析」获取基于当前生产数据的风险评估</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Row 5: Workstation Utilization Chart */}
      {capacity.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
          <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-blue-500" /> 工站负载分布
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={capacity.map(c => ({ name: c.workstation_name, 利用率: c.utilization_pct }))}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} unit="%" />
              <RechartsTooltip formatter={(v: number) => [`${v}%`, '利用率']} />
              <Bar dataKey="利用率" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Row 6: Quick Links */}
      <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
        <h3 className="text-sm font-bold text-gray-800 mb-4">快捷入口</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {QUICK_LINKS.map(link => {
            const lc = LINK_COLORS[link.color] || LINK_COLORS.gray;
            return (
              <Link key={link.href} to={link.href} className={`block p-4 rounded-lg border border-gray-200 ${lc.border} ${lc.bg} transition-colors`}>
                <p className={`text-sm font-bold ${lc.text}`}>{link.label}</p>
                <p className="text-[10px] text-gray-500 mt-1">{link.desc}</p>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
