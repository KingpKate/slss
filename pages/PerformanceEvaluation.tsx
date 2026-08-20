import React, { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays, Check, CheckCircle2, ClipboardCheck, Download, Edit3, Eye, FileSpreadsheet, Loader2, RefreshCw, Save, Search,
  Send, UploadCloud, X,
} from 'lucide-react';
import { api } from '../services/apiClient';
import { useAuth } from '../components/AuthContext';

type ScoreRow = { itemId: number; score: number; comment?: string };
type Item = { itemId: number; itemCode: string; keyFactor: string; standard: string; maxScore: number; evaluatorScope?: string[] };
type Section = { sectionId: string; name: string; sectionWeight: number; items: Item[] };
type TemplateRow = { id: number; name: string; sourceSheet?: string; departmentId: string; departmentName: string; version: number; status: string; publishedAt?: string; sections?: number };

const statusLabel: Record<string, string> = { ACTIVE: '已发布', DRAFT: '草稿', ARCHIVED: '已归档', CLOSED: '已关闭', SUBMITTED: '已提交', IN_PROGRESS: '填写中', LOCKED: '已锁定', CANCELLED: '已取消' };
const formatStatus = (value?: string) => statusLabel[String(value || '').toUpperCase()] || value || '未知';
const formatDate = (value?: string) => value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '—';

function extractScores(value: any): ScoreRow[] {
  const candidates = [value?.scores, value?.scoreDetails, value?.entries, value?.evaluation?.scores].find(Array.isArray) || [];
  return candidates.map((row: any) => ({
    itemId: Number(row.itemId ?? row.item_id ?? row.item?.id),
    score: Number(row.score),
    comment: row.comment ?? row.remark ?? '',
  })).filter((row: ScoreRow) => Number.isFinite(row.itemId) && Number.isFinite(row.score));
}

export default function PerformanceEvaluation() {
  const { user } = useAuth();
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [mode, setMode] = useState<'subject' | 'evaluator'>('subject');
  const [schema, setSchema] = useState<any>(null);
  const [evaluation, setEvaluation] = useState<any>(null);
  const [scores, setScores] = useState<Record<number, number>>({});
  const [comments, setComments] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [adminTemplates, setAdminTemplates] = useState<TemplateRow[]>([]);
  const [adminResults, setAdminResults] = useState<any[]>([]);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [templateSearch, setTemplateSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('ALL');
  const [templateStatusFilter, setTemplateStatusFilter] = useState('ALL');
  const [importDuplicateMode, setImportDuplicateMode] = useState<'skip' | 'stop'>('skip');
  const [selectedResult, setSelectedResult] = useState<any>(null);
  const [showImportHelp, setShowImportHelp] = useState(false);
  const [adminTab, setAdminTab] = useState<'templates' | 'cycles' | 'results'>('templates');
  const [cycleStatus, setCycleStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [cycleWindows, setCycleWindows] = useState({ startsAt: '', endsAt: '', publishedAt: '', dueAt: '' });
  const [editingTemplateOriginal, setEditingTemplateOriginal] = useState<any>(null);
  const [importPreview, setImportPreview] = useState<{ name: string; size: number; lastModified: number } | null>(null);
  const [importToken, setImportToken] = useState<string | null>(null);
  const [importReport, setImportReport] = useState<{ templates: number; sheets: string[]; duplicates: string[]; errors: string[] } | null>(null);
  const [assignmentTasks, setAssignmentTasks] = useState<any[]>([]);
  const [adminAssignmentTasks, setAdminAssignmentTasks] = useState<any[]>([]);
  const [assignmentForm, setAssignmentForm] = useState({ templateId: '', subjectUserId: '', evaluatorUserId: '', mode: 'subject' });
  const [standards, setStandards] = useState<any[]>([
    { grade: 'A', label: '突出贡献', minScore: 100, maxScore: null, reward: '500' },
    { grade: 'B', label: '优秀', minScore: 90, maxScore: 99, reward: '0' },
    { grade: 'C', label: '一般', minScore: 80, maxScore: 89, reward: '-200' },
    { grade: 'D', label: '较差', minScore: 70, maxScore: 79, reward: '-300' },
    { grade: 'E', label: '不合格', minScore: 60, maxScore: 69, reward: '-500' },
    { grade: 'F', label: '严重不合格', minScore: 0, maxScore: 59, reward: '月度绩效' },
  ]);
  const [resultPage, setResultPage] = useState(0);
  const resultPageSize = 20;
  const isAdmin = Boolean(user?.permissions.includes('MANAGE_PERFORMANCE' as any) || user?.permissions.includes('MANAGE_SYSTEM'));

  const showError = (error: any, fallback: string) => setMessage({ type: 'error', text: error?.message || fallback });

  const hydrateEvaluation = (value: any) => {
    const rows = extractScores(value);
    if (!rows.length) return;
    // Backend is authoritative when a draft is reopened or refreshed. Local
    // values are retained only for fields that the response does not include.
    setScores(previous => ({ ...previous, ...rows.reduce((next, row) => ({ ...next, [row.itemId]: row.score }), {}) }));
    setComments(previous => ({ ...previous, ...rows.reduce((next, row) => ({ ...next, [row.itemId]: row.comment || '' }), {}) }));
  };

  const load = async () => {
    setBusy(true); setMessage(null);
    try {
      const [remoteSchema, remoteEvaluation, tasks] = await Promise.all([
        api.performanceCurrent(period, mode),
        api.openPerformanceEvaluation(period, mode),
        api.performanceAssignmentInbox(period).catch(() => []),
      ]);
      setSchema(remoteSchema); setEvaluation(remoteEvaluation); hydrateEvaluation(remoteEvaluation);
      setAssignmentTasks(tasks || []);
    } catch (error: any) { showError(error, '评价模板加载失败'); }
    finally { setBusy(false); }
  };

  const loadAdmin = async () => {
    setBusy(true); setMessage(null);
    try {
      const [templates, results, tasks, remoteStandards] = await Promise.all([
        api.performanceTemplates(), api.performanceResults(period),
        api.performanceAssignmentTasks(period).catch(() => []), api.performanceStandards().catch(() => []),
      ]);
      setAdminTemplates(templates || []); setAdminResults(results || []); setResultPage(0); setAdminAssignmentTasks(tasks || []);
      if (remoteStandards?.length) setStandards(remoteStandards);
    } catch (error: any) { showError(error, '绩效管理数据加载失败'); }
    finally { setBusy(false); }
  };

  const createCycle = async () => {
    setBusy(true); setCycleStatus(null);
    try {
      const cycle = await api.openPerformanceCycle(period, Object.fromEntries(Object.entries(cycleWindows).filter(([, value]) => value).map(([key, value]) => [key, new Date(value).toISOString()])) as any);
      setCycleStatus({ type: 'success', text: `${cycle.periodCode} 周期已打开（版本 ${cycle.version}），主管现在可以开始填写。` });
    } catch (error: any) {
      setCycleStatus({ type: 'error', text: error?.message || '绩效周期创建失败' });
    } finally { setBusy(false); }
  };

  useEffect(() => {
    setScores({}); setComments({}); setEvaluation(null); setSchema(null);
    if (isAdmin) loadAdmin(); else load();
    // The selected period/mode is the request identity. The callbacks intentionally
    // run once for each identity; API responses are not stored in browser storage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, mode, isAdmin]);

  const sections: Section[] = schema?.template?.sections || [];
  const allItems = useMemo(() => sections.flatMap(section => section.items), [sections]);
  const completion = allItems.length ? Math.round((allItems.filter(item => scores[item.itemId] != null).length / allItems.length) * 100) : 0;
  const departments = useMemo(() => Array.from(new Map(adminTemplates.map(item => [item.departmentId, item.departmentName])).entries()), [adminTemplates]);
  const filteredTemplates = useMemo(() => adminTemplates.filter(item => {
    const matchSearch = !templateSearch || [item.name, item.departmentName, item.sourceSheet].join(' ').toLowerCase().includes(templateSearch.toLowerCase());
    const matchDepartment = departmentFilter === 'ALL' || item.departmentId === departmentFilter;
    const matchStatus = templateStatusFilter === 'ALL' || item.status === templateStatusFilter;
    return matchSearch && matchDepartment && matchStatus;
  }), [adminTemplates, templateSearch, departmentFilter, templateStatusFilter]);
  const resultPageCount = Math.max(1, Math.ceil(adminResults.length / resultPageSize));
  const pagedResults = useMemo(() => adminResults.slice(resultPage * resultPageSize, (resultPage + 1) * resultPageSize), [adminResults, resultPage, resultPageSize]);

  const exportResults = () => {
    const headers = ['部门', '评价人', '模板', '状态', '原始分', '归一化分'];
    const rows = adminResults.map(result => [result.departmentName || result.departmentId || '', result.username || '', result.templateName || '', formatStatus(result.status), result.rawScore ?? '', result.normalizedScore ?? '']);
    const csv = [headers, ...rows].map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `绩效结果_${period}.csv`; anchor.click(); URL.revokeObjectURL(url);
  };

  const updateScore = (item: Item, value: string) => {
    if (value === '') { setScores(previous => { const next = { ...previous }; delete next[item.itemId]; return next; }); return; }
    const parsed = Number(value); if (!Number.isFinite(parsed)) return;
    setScores(previous => ({ ...previous, [item.itemId]: Math.max(0, Math.min(item.maxScore, parsed)) }));
  };

  const save = async (submit = false) => {
    if (!evaluation?.id) return;
    if (submit && !confirmSubmit) { setConfirmSubmit(true); return; }
    setConfirmSubmit(false); setBusy(true); setMessage(null);
    try {
      const payload = allItems.filter(item => scores[item.itemId] != null).map(item => ({ itemId: item.itemId, score: scores[item.itemId], comment: comments[item.itemId] || undefined }));
      const saved = await api.savePerformanceScores(evaluation.id, payload, evaluation.version, mode);
      setEvaluation(saved); hydrateEvaluation(saved);
      if (submit) {
        const submitted = await api.submitPerformanceEvaluation(evaluation.id, saved.version, mode);
        setEvaluation(submitted); hydrateEvaluation(submitted); setMessage({ type: 'success', text: `已提交 ${period} 绩效评价，提交后由系统锁定并记录审计信息。` });
      } else setMessage({ type: 'success', text: '草稿已保存，其他设备刷新后可继续查看。' });
    } catch (error: any) { showError(error, '评分保存失败，请刷新后重试'); }
    finally { setBusy(false); }
  };

  const importExcel = async (file?: File) => {
    if (!file) return;
    if (!/\.xlsx$/i.test(file.name)) { setMessage({ type: 'error', text: '仅支持 .xlsx 文件。' }); return; }
    if (file.size > 20 * 1024 * 1024) { setMessage({ type: 'error', text: '文件不能超过 20 MB。' }); return; }
    setImportPreview({ name: file.name, size: file.size, lastModified: file.lastModified });
    setBusy(true); setMessage(null);
    try {
      const report = await api.previewPerformanceExcel(file);
      setImportReport(report); setImportToken(report.token || null);
      if (report.errors?.length) setMessage({ type: 'error', text: `预览发现 ${report.errors.length} 个问题，请修正后重新上传` });
      else setMessage({ type: 'success', text: `预览通过：${report.templates} 个模板，${report.duplicates?.length || 0} 个重复版本。确认后才会写入模板库。` });
    } catch (error: any) { showError(error, 'Excel 导入失败，请先检查模板结构和重复版本'); }
    finally { setBusy(false); }
  };

  const confirmImport = async () => {
    if (!importToken || importReport?.errors?.length) return;
    setBusy(true);
    try {
      const report = await api.confirmPerformanceExcel(importToken, importDuplicateMode);
      setMessage({ type: report.errors?.length ? 'error' : 'success', text: `导入完成：${report.imported || 0} 个模板，跳过 ${report.skipped?.length || 0} 个重复模板` });
      setImportToken(null); setImportReport(null); await loadAdmin();
    } catch (error: any) { showError(error, '确认导入失败，请重新预览'); }
    finally { setBusy(false); }
  };

  const openAssignment = async (task: any) => {
    setBusy(true);
    try { const opened = await api.openPerformanceAssignment(task.id); setEvaluation(opened); hydrateEvaluation(opened); setMessage({ type: 'success', text: `已打开 ${task.subjectUsername || '被评价人'} 的评价任务` }); }
    catch (error: any) { showError(error, '评价任务打开失败'); }
    finally { setBusy(false); }
  };

  const createAssignment = async () => {
    if (!assignmentForm.templateId || !assignmentForm.subjectUserId || !assignmentForm.evaluatorUserId) {
      setMessage({ type: 'error', text: '请填写模板、被评价人和评价人账号 ID。' }); return;
    }
    setBusy(true);
    try {
      await api.createPerformanceAssignment({ periodCode: period, templateId: Number(assignmentForm.templateId), subjectUserId: Number(assignmentForm.subjectUserId), evaluatorUserId: Number(assignmentForm.evaluatorUserId), mode: assignmentForm.mode });
      setMessage({ type: 'success', text: '评价任务已创建。' }); setAssignmentForm(previous => ({ ...previous, subjectUserId: '', evaluatorUserId: '' })); await loadAdmin();
    } catch (error: any) { showError(error, '评价任务创建失败'); }
    finally { setBusy(false); }
  };

  const saveStandards = async () => {
    setBusy(true);
    try { await api.updatePerformanceStandards(standards); setMessage({ type: 'success', text: '评定标准已保存，后续评分将按新规则计算。' }); }
    catch (error: any) { showError(error, '评定标准保存失败'); }
    finally { setBusy(false); }
  };

  const updateTemplate = async (template: TemplateRow) => {
    try {
      if (template.status === 'ACTIVE') await api.updatePerformanceTemplate(template.id, { status: 'ARCHIVED' });
      else await api.publishPerformanceTemplate(template.id);
      setMessage({ type: 'success', text: template.status === 'ACTIVE' ? '模板已归档' : '模板已发布，新周期将使用该版本' });
      await loadAdmin();
    } catch (error: any) { showError(error, '模板状态更新失败'); }
  };

  const openTemplateEditor = async (template: TemplateRow) => {
    try { const detail = await api.performanceTemplateDetail(template.id); setEditingTemplate(detail); setEditingTemplateOriginal(JSON.parse(JSON.stringify(detail))); }
    catch (error: any) { showError(error, '模板详情加载失败'); }
  };

  const templateDiffCount = useMemo(() => {
    if (!editingTemplate || !editingTemplateOriginal) return 0;
    return JSON.stringify(editingTemplate) === JSON.stringify(editingTemplateOriginal) ? 0 : 1;
  }, [editingTemplate, editingTemplateOriginal]);

  const saveTemplateRevision = async () => {
    if (!editingTemplate) return;
    try {
      const next = await api.revisePerformanceTemplate(editingTemplate.id, { departmentId: editingTemplate.departmentId, templateName: editingTemplate.name, sourceSheet: editingTemplate.sourceSheet, sections: editingTemplate.sections });
      setMessage({ type: 'success', text: `已保存新版本 V${next.version} 草稿，发布后才会对新周期生效。` }); setEditingTemplate(null); await loadAdmin();
    } catch (error: any) { showError(error, '模板保存失败，请检查权重合计和指标分值'); }
  };

  return <div className="space-y-6">
    {isAdmin && adminTab === 'results' && <section className="slss-panel flex flex-wrap items-center justify-between gap-3 p-4"><div className="text-sm text-[var(--color-text-muted)]">结果共 {adminResults.length} 条，当前第 {adminResults.length ? resultPage + 1 : 0} / {Math.max(1, Math.ceil(adminResults.length / resultPageSize))} 页</div><div className="flex gap-2"><button className="slss-button-secondary min-h-8 px-3 py-1 text-xs" onClick={() => setResultPage(page => Math.max(0, page - 1))} disabled={resultPage === 0}>上一页</button><button className="slss-button-secondary min-h-8 px-3 py-1 text-xs" onClick={() => setResultPage(page => Math.min(Math.max(0, Math.ceil(adminResults.length / resultPageSize) - 1), page + 1))} disabled={resultPage >= Math.max(0, Math.ceil(adminResults.length / resultPageSize) - 1)}>下一页</button><button className="slss-button-secondary min-h-8 px-3 py-1 text-xs" onClick={exportResults} disabled={!adminResults.length}><Download size={14}/>导出 CSV</button></div></section>}
    {isAdmin && <section className="slss-panel p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="slss-eyebrow">TASK ASSIGNMENT</p><h2 className="mt-1 text-lg font-semibold">评价任务分配</h2><p className="mt-1 text-sm text-[var(--color-text-muted)]">管理员为指定评价人创建本周期任务；后端负责部门范围和重复任务校验。</p></div><span className="slss-status-badge">{adminAssignmentTasks.length} 项任务</span></div><div className="mt-4 grid gap-3 md:grid-cols-5"><select className="slss-input" value={assignmentForm.templateId} onChange={e => setAssignmentForm(previous => ({ ...previous, templateId: e.target.value }))}><option value="">选择模板</option>{adminTemplates.filter(item => item.status === 'ACTIVE').map(item => <option key={item.id} value={item.id}>{item.departmentName} · {item.name} V{item.version}</option>)}</select><input className="slss-input" inputMode="numeric" placeholder="被评价人用户 ID" value={assignmentForm.subjectUserId} onChange={e => setAssignmentForm(previous => ({ ...previous, subjectUserId: e.target.value }))}/><input className="slss-input" inputMode="numeric" placeholder="评价人用户 ID" value={assignmentForm.evaluatorUserId} onChange={e => setAssignmentForm(previous => ({ ...previous, evaluatorUserId: e.target.value }))}/><select className="slss-input" value={assignmentForm.mode} onChange={e => setAssignmentForm(previous => ({ ...previous, mode: e.target.value }))}><option value="subject">自评</option><option value="evaluator">主管/协同评价</option></select><button className="slss-button-primary" onClick={createAssignment} disabled={busy}><ClipboardCheck size={15}/>创建任务</button></div></section>}
    {isAdmin && <section className="slss-panel p-5"><div className="flex items-center justify-between gap-3"><div><p className="slss-eyebrow">GRADE POLICY</p><h2 className="mt-1 text-lg font-semibold">评定标准配置</h2><p className="mt-1 text-sm text-[var(--color-text-muted)]">规则来自 Excel《评定标准》，保存后由后端计分引擎执行。</p></div><button className="slss-button-secondary" onClick={saveStandards} disabled={busy}><Save size={15}/>保存规则</button></div><div className="mt-4 overflow-x-auto"><table className="slss-table"><thead><tr><th>等级</th><th>名称</th><th>最低分</th><th>最高分</th><th>奖励/扣款</th></tr></thead><tbody>{standards.map((rule, index) => <tr key={rule.grade}><td className="font-semibold">{rule.grade}</td><td><input className="slss-input py-1" value={rule.label || ''} onChange={e => setStandards(previous => previous.map((item, i) => i === index ? { ...item, label: e.target.value } : item))}/></td><td><input className="slss-input w-24 py-1" type="number" value={rule.minScore ?? ''} onChange={e => setStandards(previous => previous.map((item, i) => i === index ? { ...item, minScore: e.target.value === '' ? null : Number(e.target.value) } : item))}/></td><td><input className="slss-input w-24 py-1" type="number" value={rule.maxScore ?? ''} onChange={e => setStandards(previous => previous.map((item, i) => i === index ? { ...item, maxScore: e.target.value === '' ? null : Number(e.target.value) } : item))}/></td><td><input className="slss-input py-1" value={rule.reward || ''} onChange={e => setStandards(previous => previous.map((item, i) => i === index ? { ...item, reward: e.target.value } : item))}/></td></tr>)}</tbody></table></div></section>}
    {!isAdmin && assignmentTasks.length > 0 && <section className="slss-panel p-5"><div className="flex items-center justify-between"><div><p className="slss-eyebrow">ASSIGNED TASKS</p><h2 className="mt-1 text-lg font-semibold">待办评价任务</h2></div><span className="slss-status-badge is-warning">{assignmentTasks.length} 项</span></div><div className="mt-3 grid gap-2 md:grid-cols-2">{assignmentTasks.map(task => <button key={task.id} className="rounded-lg border border-[var(--color-border)] p-3 text-left hover:border-[var(--color-primary)]" onClick={() => openAssignment(task)}><div className="flex items-center justify-between"><b>{task.subjectUsername || '被评价人'}</b><span className="text-xs text-[var(--color-text-muted)]">{formatStatus(task.status)}</span></div><div className="mt-1 text-xs text-[var(--color-text-muted)]">{task.templateName} · {task.subjectDepartmentId} · 截止 {formatDate(task.dueAt)}</div></button>)}</div></section>}
    {isAdmin && <section className="slss-panel p-5"><div className="mb-3"><p className="slss-eyebrow">PUBLICATION WINDOW</p><h2 className="mt-1 text-lg font-semibold">周期发布与截止窗口</h2><p className="mt-1 text-xs text-[var(--color-text-muted)]">时间由后端保存并强制校验，空值表示不设置该窗口。</p></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{(['startsAt','endsAt','publishedAt','dueAt'] as const).map(key => <label key={key} className="text-xs font-medium">{{ startsAt: '生效开始', endsAt: '生效结束', publishedAt: '发布日期', dueAt: '评价截止' }[key]}<input type="datetime-local" className="slss-input mt-1 w-full" value={cycleWindows[key]} onChange={event => setCycleWindows(previous => ({ ...previous, [key]: event.target.value }))}/></label>)}</div></section>}
    <header className="slss-page-header"><div><p className="slss-eyebrow">PERFORMANCE CONTROL</p><h1 className="slss-heading">{isAdmin ? '绩效管理后台' : '主管绩效评价台'}</h1><p className="slss-subheading">{isAdmin ? '发布部门绩效模板并查看各部门最终评分，管理员不参与绩效评分。' : '评价字段由后端模板动态生成，部门权限自动裁剪。'}</p></div><div className="flex flex-wrap gap-2">
      {isAdmin ? <><label className="slss-button-secondary cursor-pointer"><UploadCloud size={16}/>批量导入 Excel<input className="hidden" type="file" accept=".xlsx" onChange={event => importExcel(event.target.files?.[0])}/></label><button className="slss-button-secondary" onClick={() => setShowImportHelp(value => !value)}><FileSpreadsheet size={16}/>导入规则</button></> : null}
      <button className="slss-button-secondary" onClick={() => isAdmin ? loadAdmin() : load()} disabled={busy}><RefreshCw size={16} className={busy ? 'animate-spin' : ''}/>刷新</button>
    </div></header>

    {isAdmin && showImportHelp && <section className="slss-panel border-l-4 border-l-[var(--color-primary)] p-5"><div className="flex gap-3"><FileSpreadsheet className="mt-0.5 text-[var(--color-primary)]" size={20}/><div><h2 className="font-semibold">Excel 导入校验规则</h2><p className="mt-1 text-sm text-[var(--color-text-muted)]">系统会识别部门工作表、商务部人员专属工作表、合并单元格权重和评定标准。重复版本可跳过或停止，正式发布前请在模板列表中检查草稿。</p><label className="mt-3 flex items-center gap-2 text-sm"><span>重复模板处理</span><select className="slss-input py-1" value={importDuplicateMode} onChange={e => setImportDuplicateMode(e.target.value as 'skip' | 'stop')}><option value="skip">跳过并继续</option><option value="stop">遇到重复立即停止</option></select></label></div></div></section>}
    <section className="slss-panel p-5"><div className="flex flex-wrap items-end gap-4"><label className="text-sm font-medium"><span className="flex items-center gap-1"><CalendarDays size={14}/>绩效周期</span><input type="month" value={period} onChange={event => setPeriod(event.target.value)} className="slss-input mt-1 block"/></label>{!isAdmin && <label className="text-sm font-medium">评价视角<select value={mode} onChange={event => setMode(event.target.value as any)} className="slss-input mt-1 block"><option value="subject">本部门评价指标</option><option value="evaluator">协同部门评价指标</option></select></label>}{!isAdmin && <div className="ml-auto min-w-[230px]"><div className="flex justify-between text-xs text-[var(--color-text-muted)]"><span>填写进度</span><span>{completion}%</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--color-surface-muted)]"><div className="h-full rounded-full bg-[var(--color-primary)] transition-all" style={{ width: `${completion}%` }}/></div></div>}</div></section>
    {message && <div className={message.type === 'error' ? 'slss-alert-error' : 'slss-alert-success'} role="status">{message.type === 'error' ? '操作失败：' : '操作成功：'}{message.text}</div>}
    {isAdmin && cycleStatus && <div className={cycleStatus.type === 'error' ? 'slss-alert-error' : 'slss-alert-success'} role="status">{cycleStatus.text}</div>}
    {isAdmin && importPreview && <div className="slss-panel flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm"><div><span><FileSpreadsheet size={15} className="mr-2 inline text-[var(--color-primary)]"/><b>{importPreview.name}</b> · {(importPreview.size / 1024 / 1024).toFixed(2)} MB</span>{importReport && <p className="mt-1 text-xs text-[var(--color-text-muted)]">结构预览：{importReport.templates} 个模板 · {importReport.sheets.length} 个工作表 · 重复 {importReport.duplicates.length} 个 · 错误 {importReport.errors.length} 个</p>}</div><div className="flex gap-2"><button className="slss-button-primary min-h-8 px-3 py-1 text-xs" disabled={!importToken || Boolean(importReport?.errors.length) || busy} onClick={confirmImport}>确认导入</button><button className="text-xs text-[var(--color-text-muted)] hover:underline" onClick={() => { setImportPreview(null); setImportToken(null); setImportReport(null); }}>取消预览</button></div></div>}

    {isAdmin && <section className="slss-panel p-5"><div className="mb-5 flex flex-wrap gap-2 border-b border-[var(--color-border)] pb-3"><button className={adminTab === 'templates' ? 'slss-button-primary' : 'slss-button-secondary'} onClick={() => setAdminTab('templates')}><FileSpreadsheet size={15}/>模板版本</button><button className={adminTab === 'cycles' ? 'slss-button-primary' : 'slss-button-secondary'} onClick={() => setAdminTab('cycles')}><CalendarDays size={15}/>绩效周期</button><button className={adminTab === 'results' ? 'slss-button-primary' : 'slss-button-secondary'} onClick={() => setAdminTab('results')}><ClipboardCheck size={15}/>评价结果</button></div>{adminTab === 'templates' && <><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="slss-eyebrow">ADMIN CONSOLE</p><h2 className="mt-1 text-lg font-semibold">模板发布与版本管理</h2><p className="mt-1 text-sm text-[var(--color-text-muted)]">发布版本按部门生效；历史版本不覆盖历史评分。管理员只维护模板与查看结果。</p></div><div className="flex flex-wrap gap-2"><label className="relative"><Search size={15} className="absolute left-2.5 top-2.5 text-[var(--color-text-muted)]"/><input className="slss-input pl-8" placeholder="搜索部门/模板" value={templateSearch} onChange={e => setTemplateSearch(e.target.value)}/></label><select className="slss-input" value={departmentFilter} onChange={e => setDepartmentFilter(e.target.value)}><option value="ALL">全部部门</option>{departments.map(([id, name]) => <option value={id} key={id}>{name}</option>)}</select><select className="slss-input" value={templateStatusFilter} onChange={e => setTemplateStatusFilter(e.target.value)}><option value="ALL">全部状态</option><option value="ACTIVE">已发布</option><option value="DRAFT">草稿</option><option value="ARCHIVED">已归档</option></select></div></div><div className="mt-4 overflow-x-auto"><table className="slss-table"><thead><tr><th>部门</th><th>模板/来源工作表</th><th>版本</th><th>分区</th><th>状态</th><th>发布日期</th><th>本周期结果</th><th>操作</th></tr></thead><tbody>{filteredTemplates.map(template => { const result = adminResults.find(item => (item.templateId != null && Number(item.templateId) === template.id) || (item.departmentId === template.departmentId && (!item.templateName || item.templateName === template.name))); return <tr key={template.id}><td>{template.departmentName}</td><td><div className="font-medium">{template.name}</div><div className="text-xs text-[var(--color-text-muted)]">{template.sourceSheet || '—'}</div></td><td>V{template.version}</td><td>{template.sections ?? '—'}</td><td><span className={`slss-status-badge ${template.status === 'ACTIVE' ? 'is-success' : template.status === 'DRAFT' ? 'is-warning' : ''}`}>{formatStatus(template.status)}</span></td><td className="text-xs">{formatDate(template.publishedAt)}</td><td>{result ? <button className="text-left text-[var(--color-primary)] hover:underline" onClick={() => setSelectedResult(result)}>{formatStatus(result.status)} · {result.normalizedScore ?? '0'}</button> : '尚未提交'}</td><td><div className="flex gap-1"><button className="slss-button-secondary min-h-8 px-2 py-1 text-xs" onClick={() => openTemplateEditor(template)}><Edit3 size={13}/>编辑</button><button className="slss-button-secondary min-h-8 px-2 py-1 text-xs" onClick={() => updateTemplate(template)}>{template.status === 'ACTIVE' ? '归档' : '发布'}</button></div></td></tr>; })}</tbody></table>{!filteredTemplates.length && <div className="p-10 text-center text-sm text-[var(--color-text-muted)]">暂无符合筛选条件的模板</div>}</div></>}{adminTab === 'cycles' && <div className="grid gap-5 md:grid-cols-[1fr_auto]"><div><p className="slss-eyebrow">CYCLE CONTROL</p><h2 className="mt-1 text-lg font-semibold">开放绩效周期</h2><p className="mt-1 text-sm text-[var(--color-text-muted)]">打开周期后，后端根据当前账号部门和已发布模板生成评价任务。重复打开同一周期是幂等操作。</p><div className="mt-4 rounded-lg border border-[var(--color-border)] p-4 text-sm"><div className="flex items-center gap-2"><CalendarDays size={16} className="text-[var(--color-primary)]"/><span>当前周期：<b>{period}</b></span></div><p className="mt-2 text-xs text-[var(--color-text-muted)]">发布窗口与截止时间由后端周期策略控制；前端不会伪造周期状态。</p></div></div><div className="flex items-end"><button className="slss-button-primary" onClick={createCycle} disabled={busy}><Check size={16}/>打开/确认周期</button></div></div>}{adminTab === 'results' && <div><div className="flex items-center justify-between"><div><p className="slss-eyebrow">RESULT REGISTER</p><h2 className="mt-1 text-lg font-semibold">{period} 评价结果</h2></div><button className="slss-button-secondary" onClick={loadAdmin} disabled={busy}><RefreshCw size={15}/>刷新结果</button></div><div className="mt-4 overflow-x-auto"><table className="slss-table"><thead><tr><th>部门</th><th>评价人</th><th>模板</th><th>状态</th><th>原始分</th><th>归一化分</th><th>详情</th></tr></thead><tbody>{pagedResults.map(result => <tr key={result.id}><td>{result.departmentName || result.departmentId || '—'}</td><td>{result.username || '—'}</td><td>{result.templateName || '—'}</td><td>{formatStatus(result.status)}</td><td>{result.rawScore ?? '0'}</td><td className="font-semibold">{result.normalizedScore ?? '0'}</td><td><button className="slss-button-secondary min-h-8 px-2 py-1 text-xs" onClick={() => setSelectedResult(result)}><Eye size={13}/>查看</button></td></tr>)}</tbody></table>{!adminResults.length && <div className="p-10 text-center text-sm text-[var(--color-text-muted)]">本周期暂无提交结果</div>}</div><div className="mt-4 flex items-center justify-between text-sm text-[var(--color-text-muted)]"><span>共 {adminResults.length} 条 · 第 {adminResults.length ? resultPage + 1 : 0}/{adminResults.length ? resultPageCount : 0} 页</span><div className="flex gap-2"><button className="slss-button-secondary min-h-8 px-3 py-1" disabled={resultPage === 0} onClick={() => setResultPage(page => Math.max(0, page - 1))}>上一页</button><button className="slss-button-secondary min-h-8 px-3 py-1" disabled={resultPage >= resultPageCount - 1} onClick={() => setResultPage(page => Math.min(resultPageCount - 1, page + 1))}>下一页</button></div></div></div>}</section>}

    {isAdmin && selectedResult && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4" role="dialog" aria-modal="true"><div className="w-full max-w-lg rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-2xl"><div className="flex items-start justify-between"><div><p className="slss-eyebrow">RESULT DETAIL</p><h2 className="mt-1 text-lg font-semibold">{selectedResult.departmentName || '部门'}绩效结果</h2></div><button aria-label="关闭结果" onClick={() => setSelectedResult(null)}><X size={18}/></button></div><dl className="mt-5 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-[var(--color-text-muted)]">评价人</dt><dd className="font-medium">{selectedResult.username || '—'}</dd></div><div><dt className="text-[var(--color-text-muted)]">状态</dt><dd className="font-medium">{formatStatus(selectedResult.status)}</dd></div><div><dt className="text-[var(--color-text-muted)]">原始分</dt><dd className="font-mono">{selectedResult.rawScore ?? '0'}</dd></div><div><dt className="text-[var(--color-text-muted)]">归一化分数</dt><dd className="font-mono font-semibold text-[var(--color-primary)]">{selectedResult.normalizedScore ?? '0'}</dd></div></dl><div className="mt-5 flex justify-end"><button className="slss-button-secondary" onClick={() => setSelectedResult(null)}>关闭</button></div></div></div>}

    {isAdmin && editingTemplate && <section className="slss-panel p-5"><div className="flex items-center justify-between gap-3"><div><p className="slss-eyebrow">TEMPLATE REVISION</p><h2 className="mt-1 text-lg font-semibold">编辑 {editingTemplate.name} · 创建新版本</h2><p className="mt-1 text-xs text-[var(--color-text-muted)]">当前发布版本不会被覆盖，保存后生成草稿，确认内容后再发布。</p></div><button className="slss-button-secondary" onClick={() => setEditingTemplate(null)}><X size={15}/>取消</button></div><div className="mt-4 grid gap-3 md:grid-cols-3"><label className="text-sm">模板名称<input className="slss-input mt-1" value={editingTemplate.name || ''} onChange={e => setEditingTemplate((current: any) => ({ ...current, name: e.target.value }))}/></label><label className="text-sm">部门<input className="slss-input mt-1" value={editingTemplate.departmentName || editingTemplate.departmentId || ''} disabled/></label><label className="text-sm">来源工作表<input className="slss-input mt-1" value={editingTemplate.sourceSheet || ''} onChange={e => setEditingTemplate((current: any) => ({ ...current, sourceSheet: e.target.value }))}/></label></div><div className="mt-4 space-y-4">{(editingTemplate.sections || []).map((section: any, sectionIndex: number) => <div className="rounded-lg border border-[var(--color-border)] p-4" key={section.sectionCode || sectionIndex}><div className="grid gap-3 md:grid-cols-[1fr_140px]"><label className="text-sm">章节名称<input className="slss-input mt-1" value={section.sectionName || ''} onChange={e => setEditingTemplate((current: any) => ({ ...current, sections: current.sections.map((s: any, i: number) => i === sectionIndex ? { ...s, sectionName: e.target.value } : s) }))}/></label><label className="text-sm">章节权重<input className="slss-input mt-1" type="number" step="0.01" min="0" max="1" value={section.sectionWeight ?? 0} onChange={e => setEditingTemplate((current: any) => ({ ...current, sections: current.sections.map((s: any, i: number) => i === sectionIndex ? { ...s, sectionWeight: Number(e.target.value) } : s) }))}/></label></div><div className="mt-3 space-y-2">{(section.items || []).map((item: any, itemIndex: number) => <div className="grid gap-2 md:grid-cols-[180px_1fr_100px]" key={item.itemCode || itemIndex}><input aria-label="关键绩效要素" className="slss-input" value={item.keyFactor || ''} onChange={e => setEditingTemplate((current: any) => ({ ...current, sections: current.sections.map((s: any, i: number) => i === sectionIndex ? { ...s, items: s.items.map((it: any, j: number) => j === itemIndex ? { ...it, keyFactor: e.target.value } : it) } : s) }))}/><textarea aria-label="考核标准" className="slss-input" value={item.standard || ''} onChange={e => setEditingTemplate((current: any) => ({ ...current, sections: current.sections.map((s: any, i: number) => i === sectionIndex ? { ...s, items: s.items.map((it: any, j: number) => j === itemIndex ? { ...it, standard: e.target.value } : it) } : s) }))}/><input aria-label="指标满分" className="slss-input" type="number" min="0" value={item.maxScore ?? 0} onChange={e => setEditingTemplate((current: any) => ({ ...current, sections: current.sections.map((s: any, i: number) => i === sectionIndex ? { ...s, items: s.items.map((it: any, j: number) => j === itemIndex ? { ...it, maxScore: Number(e.target.value) } : it) } : s) }))}/></div>)}</div></div>)}</div><div className="mt-5 flex justify-end"><button className="slss-button-primary" onClick={saveTemplateRevision}><Save size={16}/>保存为新版本草稿</button></div></section>}

    {!isAdmin && schema?.principal && <div className="slss-panel border-l-4 border-l-[var(--color-primary)] p-5"><p className="text-xs font-semibold uppercase tracking-[.16em] text-[var(--color-text-muted)]">当前评价范围</p><p className="mt-2 text-lg font-semibold">您正在进行 <span className="text-[var(--color-primary)]">{schema.principal.departmentName}</span> 的专属指标评价</p><p className="mt-1 text-sm text-[var(--color-text-muted)]">模板：{schema.template.name || schema.template.departmentName} · 版本 V{schema.template.version} · 周期 {schema.cycle.periodCode} · {mode === 'evaluator' ? '协同评价视角' : '本部门评价视角'}</p></div>}
    {!isAdmin && busy && !schema ? <div className="slss-panel flex items-center justify-center gap-2 p-12 text-sm text-[var(--color-text-muted)]"><Loader2 className="animate-spin" size={18}/>正在加载动态模板…</div> : null}
    {!busy && schema && !sections.length ? <div className="slss-panel p-12 text-center text-sm text-[var(--color-text-muted)]">当前部门暂无可见指标，请联系管理员配置部门归属。</div> : null}
    {!isAdmin && <div className="space-y-5">{sections.map(section => <section className="slss-panel overflow-hidden" key={section.sectionId}><div className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface-muted)] px-5 py-4"><div><h2 className="font-semibold">{section.name}</h2><p className="mt-1 text-xs text-[var(--color-text-muted)]">权重 {(Number(section.sectionWeight) * 100).toFixed(0)}% · {section.items.length} 项</p></div><CheckCircle2 size={18} className={section.items.every(item => scores[item.itemId] != null) ? 'text-[var(--color-success)]' : 'text-[var(--color-text-muted)]'}/></div><div className="divide-y divide-[var(--color-border)]">{section.items.map(item => <div className="grid gap-4 px-5 py-4 lg:grid-cols-[minmax(180px,.7fr)_minmax(260px,1.5fr)_120px_220px] lg:items-center" key={item.itemId}><div><p className="text-sm font-semibold">{item.keyFactor}</p><p className="mt-1 text-xs text-[var(--color-text-muted)]">{item.itemCode} · 满分 {item.maxScore}</p></div><p className="text-sm leading-6 text-[var(--color-text-secondary)]">{item.standard}</p><label className="text-xs font-medium text-[var(--color-text-muted)]">评分<input type="number" min="0" max={item.maxScore} step="0.5" value={scores[item.itemId] ?? ''} disabled={['SUBMITTED', 'LOCKED'].includes(evaluation?.status)} onChange={event => updateScore(item, event.target.value)} className="slss-input mt-1 w-full"/></label><input value={comments[item.itemId] || ''} disabled={['SUBMITTED', 'LOCKED'].includes(evaluation?.status)} onChange={event => setComments(previous => ({ ...previous, [item.itemId]: event.target.value }))} placeholder="可填写评价说明" className="slss-input"/></div>)}</div></section>)}</div>}
    {!isAdmin && evaluation && <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/95 p-4 shadow-lg backdrop-blur"><span className="text-sm text-[var(--color-text-muted)]">状态：<b className="text-[var(--color-text)]">{formatStatus(evaluation.status)}</b> · 版本 {evaluation.version} · 当前得分 {evaluation.normalizedScore ?? '—'}</span><div className="flex items-center gap-2">{confirmSubmit && <span className="text-xs text-[var(--color-warning)]">再次点击“确认提交”完成本周期提交</span>}<button className="slss-button-secondary" onClick={() => save(false)} disabled={busy || ['SUBMITTED', 'LOCKED'].includes(evaluation.status)}><Save size={16}/>保存草稿</button><button className="slss-button-primary" onClick={() => save(true)} disabled={busy || ['SUBMITTED', 'LOCKED'].includes(evaluation.status)}><Send size={16}/>{confirmSubmit ? '确认提交' : '保存并提交'}</button></div></div>}
  </div>;
}
