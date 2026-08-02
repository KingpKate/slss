
import React, { useState, useEffect, useRef } from 'react';
import { UserRole, User, Permission, DatabaseConfig, RedisConfig, SystemStatus } from '../types';
import { useTheme, THEMES, ThemeColor } from '../components/ThemeContext';
import { 
  Shield, UserCheck, Settings, Save, Key, Globe, Cpu, AlertCircle, CheckCircle, 
  Database, Activity, Server, HardDrive, Zap, RefreshCw, Lock, Radio, Network,
  Palette, X
} from 'lucide-react';
import { ROLE_LABELS, PERMISSION_LABELS } from '../constants';
import { api } from '../services/apiClient';

// All administrative data is now loaded from the Spring API; this constant is
// kept only for backwards-compatible render guards in legacy markup.
const USE_MOCK_DATA = false;

const PERMISSION_DOMAINS: Record<string, Permission[]> = {
  production: ['VIEW_PRODUCTION','MANAGE_PRODUCTION','OPERATE_SCAN','CREATE_SCAN_TABLE','DELETE_SCAN_TABLE','MANAGE_SCAN_TEMPLATE','USE_SCAN_TEMPLATE','ADD_PRODUCTION_COLUMN','DELETE_PRODUCTION_COLUMN','FORCE_DUPLICATE_SN','FORCE_EDIT_COMPLETED_SCAN','FORCE_COMPLETE_SCAN','MANAGE_PRODUCTION_REPAIR'] as Permission[],
  afterSales: ['VIEW_ORDERS','MANAGE_ORDERS'] as Permission[],
  salesProcurement: ['MANAGE_SALES','MANAGE_PROCUREMENT'] as Permission[],
  system: ['VIEW_DASHBOARD','MANAGE_SYSTEM'] as Permission[],
};
const PERMISSION_DOMAIN_LABELS: Record<string, string> = {
  all: '全部业务域', production: '生产管理', afterSales: '售后管理', salesProcurement: '销售与采购', system: '系统管理'
};

/**
 * API gateway onboarding examples.  Keep these examples close to the form so
 * an operator can see exactly which URL shape is expected before saving a
 * channel.  The backend treats baseUrl as the provider root and appends the
 * discovery/chat paths itself (for example `/v1` -> `/v1/models` and
 * `/v1/chat/completions`).
 */
const AI_CHANNEL_PRESETS = [
  {
    key: 'openai-compatible',
    label: 'OpenAI / New API',
    protocol: 'OPENAI_COMPATIBLE',
    baseUrl: 'https://api.openai.com/v1',
    model: '',
    discovery: 'GET /v1/models',
    chat: 'POST /v1/chat/completions',
    description: '适用于 OpenAI、New API、DeepSeek、通义以及其他 OpenAI-compatible 网关。',
  },
  {
    key: 'gemini',
    label: 'Google Gemini',
    protocol: 'GEMINI',
    baseUrl: 'https://generativelanguage.googleapis.com',
    model: '',
    discovery: 'GET /v1beta/models?key=API_KEY',
    chat: 'POST /v1beta/models/{model}:generateContent',
    description: 'Gemini 使用 Google API 根地址，系统会自动补齐 v1beta 路径。',
  },
  {
    key: 'anthropic',
    label: 'Anthropic Claude',
    protocol: 'ANTHROPIC',
    baseUrl: 'https://api.anthropic.com',
    model: 'claude-3-5-sonnet-latest',
    discovery: '不提供标准 /models，需填写模型名',
    chat: 'POST /v1/messages',
    description: 'Anthropic 官方接口没有统一模型目录，因此需要手动填写模型名称。',
  },
  {
    key: 'custom',
    label: '自定义 API',
    protocol: 'CUSTOM',
    baseUrl: 'https://your-gateway.example.com/v1',
    model: '',
    discovery: 'GET {Base URL}/models',
    chat: 'POST {Base URL}/chat/completions',
    description: '自定义网关请提供 OpenAI-compatible 响应格式；Base URL 不要填写 /models。',
  },
] as const;

const normalizePermissionList = (values: unknown): Permission[] =>
  (Array.isArray(values) ? values : [])
    .map(value => String(value).replace(/^PERM_/, '')) as Permission[];

// --- Sub-components for better organization ---

const StatusIndicator = ({ status, text }: { status: 'good' | 'warning' | 'error' | 'neutral', text: string }) => {
  const colors = { good: 'var(--status-good)', warning: 'var(--status-warning)', error: 'var(--status-error)', neutral: 'var(--status-neutral)' };
  return (
    <div className="flex items-center space-x-2">
      <div className="h-2.5 w-2.5 rounded-full animate-pulse" style={{ backgroundColor: colors[status] }} />
      <span className="text-sm font-medium text-slate-700">{text}</span>
    </div>
  );
};

const AdminPanel: React.FC = () => {
  // -- Navigation State --
  const [activeTab, setActiveTab] = useState<'overview' | 'status' | 'database' | 'ai' | 'users' | 'general'>('overview');
  const { theme, setTheme, themeConfig } = useTheme();

  // -- Config States --
  const [users, setUsers] = useState<User[]>([]); const [userPage,setUserPage]=useState(0); const [userTotalPages,setUserTotalPages]=useState(0);
  const [permissionView, setPermissionView] = useState<'users' | 'groups'>('users');
  const [permissionGroups, setPermissionGroups] = useState<any[]>([]);
  const [selectedPermissionGroup, setSelectedPermissionGroup] = useState<number | null>(null);
  const [groupForm, setGroupForm] = useState({ name: '', description: '' });
  const [groupCreateDialog, setGroupCreateDialog] = useState(false);
  const [groupDirty, setGroupDirty] = useState(false);
  const [groupMemberSearch, setGroupMemberSearch] = useState('');
  const [permissionDomain, setPermissionDomain] = useState('all');
  const [permissionSearch, setPermissionSearch] = useState('');
  const [authorizedOnly, setAuthorizedOnly] = useState(false);
  const [permissionDiff, setPermissionDiff] = useState<{ username: string; added: string[]; removed: string[] } | null>(null);
  const [permissionDetail, setPermissionDetail] = useState<any | null>(null);
  const [permissionSimulation, setPermissionSimulation] = useState<any | null>(null);
  const [permissionAuditRows, setPermissionAuditRows] = useState<any[]>([]);
  const [permissionApprovals, setPermissionApprovals] = useState<any[]>([]);
  const [denyCandidate, setDenyCandidate] = useState('');
  const [scopePermission, setScopePermission] = useState('');
  const [scopeType, setScopeType] = useState('TENANT');
  const [scopeValue, setScopeValue] = useState('');
  const [permissionDirty, setPermissionDirty] = useState<Set<number>>(new Set());
  const [auditRows,setAuditRows]=useState<any[]>([]); const [auditPage,setAuditPage]=useState(0); const [auditTotalPages,setAuditTotalPages]=useState(0); const [auditAction,setAuditAction]=useState('');
  const [sessions,setSessions]=useState<any[]>([]); const [sessionPage,setSessionPage]=useState(0); const [sessionTotalPages,setSessionTotalPages]=useState(0);
  const [tenants,setTenants]=useState<any[]>([]); const [tenantPage,setTenantPage]=useState(0); const [tenantTotalPages,setTenantTotalPages]=useState(0); const [tenantForm,setTenantForm]=useState({tenantCode:'',tenantName:''}); const [tenantAsset,setTenantAsset]=useState('');
  const [userDialog,setUserDialog]=useState<{mode:'create'|'edit'; user?:User}|null>(null);
  const [credentialForm,setCredentialForm]=useState({username:'',password:'',role:'TECHNICIAN'});
  const [adminError,setAdminError]=useState('');
  const [adminOverview, setAdminOverview] = useState<any | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const permissionMatrixRef = useRef<HTMLDivElement>(null);
  const permissionDragRef = useRef({ active: false, startX: 0, scrollLeft: 0 });
  const [permissionDragging, setPermissionDragging] = useState(false);
  const [permissionScroll, setPermissionScroll] = useState({ left: 0, max: 0 });
  const permissionTrackRef = useRef<HTMLDivElement>(null);
  const permissionScrollbarRef = useRef<HTMLDivElement>(null);
  const permissionThumbDragRef = useRef({ active: false, startX: 0, startLeft: 0 });
  const updatePermissionScroll = () => {
    const container = permissionMatrixRef.current;
    if (!container) return;
    setPermissionScroll({ left: container.scrollLeft, max: Math.max(0, container.scrollWidth - container.clientWidth) });
    if (permissionScrollbarRef.current && Math.abs(permissionScrollbarRef.current.scrollLeft - container.scrollLeft) > 1) {
      permissionScrollbarRef.current.scrollLeft = container.scrollLeft;
    }
  };
  useEffect(() => {
    if (activeTab !== 'users') return;
    const frame = requestAnimationFrame(updatePermissionScroll);
    const observer = new ResizeObserver(updatePermissionScroll);
    if (permissionMatrixRef.current) observer.observe(permissionMatrixRef.current);
    window.addEventListener('resize', updatePermissionScroll);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', updatePermissionScroll);
    };
  }, [activeTab, users.length]);
  const startPermissionDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    if ((event.target as HTMLElement).closest('input,button,a,select,textarea,label')) return;
    const container = permissionMatrixRef.current;
    if (!container) return;
    permissionDragRef.current = { active: true, startX: event.clientX, scrollLeft: container.scrollLeft };
    container.setPointerCapture(event.pointerId);
    setPermissionDragging(true);
    event.preventDefault();
  };
  const movePermissionDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!permissionDragRef.current.active || !permissionMatrixRef.current) return;
    permissionMatrixRef.current.scrollLeft = permissionDragRef.current.scrollLeft - (event.clientX - permissionDragRef.current.startX);
    event.preventDefault();
  };
  const stopPermissionDrag = (event?: React.PointerEvent<HTMLDivElement>) => {
    if (event && permissionMatrixRef.current?.hasPointerCapture(event.pointerId)) {
      permissionMatrixRef.current.releasePointerCapture(event.pointerId);
    }
    permissionDragRef.current.active = false;
    setPermissionDragging(false);
  };
  const wheelPermissionMatrix = (event: React.WheelEvent<HTMLDivElement>) => {
    const container = permissionMatrixRef.current;
    if (!container || Math.abs(event.deltaX) > Math.abs(event.deltaY) || !event.deltaY) return;
    container.scrollLeft += event.deltaY;
  };
  const setPermissionScrollLeft = (left: number) => {
    const next = Math.max(0, Math.min(left, permissionScroll.max));
    if (permissionMatrixRef.current) permissionMatrixRef.current.scrollLeft = next;
    setPermissionScroll(previous => ({ ...previous, left: next }));
  };
  const clickPermissionTrack = (event: React.PointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
    if (event.target !== event.currentTarget || !permissionTrackRef.current) return;
    const rect = permissionTrackRef.current.getBoundingClientRect();
    const ratio = (event.clientX - rect.left) / rect.width;
    setPermissionScrollLeft(ratio * permissionScroll.max);
    event.preventDefault();
  };
  const startPermissionThumbDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
    if (!permissionTrackRef.current) return;
    permissionThumbDragRef.current = { active: true, startX: event.clientX, startLeft: permissionScroll.left };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };
  const movePermissionThumbDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!permissionThumbDragRef.current.active || !permissionTrackRef.current) return;
    const trackWidth = permissionTrackRef.current.clientWidth;
    const thumbWidth = Math.max(36, trackWidth * 0.24);
    const travel = Math.max(1, trackWidth - thumbWidth);
    setPermissionScrollLeft(permissionThumbDragRef.current.startLeft + (event.clientX - permissionThumbDragRef.current.startX) * permissionScroll.max / travel);
    event.preventDefault();
  };
  const stopPermissionThumbDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    permissionThumbDragRef.current.active = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  useEffect(() => {
    api.listUsers(userPage,50).then(page => { setUserTotalPages(page.totalPages||0); setUsers((page.content || []).map((u:any) => ({ id:u.id, username:u.username, role:(u.roles?.find((r:string) => !r.startsWith('GROUP_')) || 'ADMIN') as UserRole, permissions:normalizePermissionList(u.permissions), personalPermissions:normalizePermissionList(u.personalPermissions), permissionGroupIds:(u.permissionGroupIds || []).map((id:any) => Number(id)), permissionSources:u.permissionSources || {}, status:u.status === 'ACTIVE' ? 'active' : 'pending', mustChangePassword:u.mustChangePassword } as User))); }).catch(err => setAdminError(err?.message || '加载用户失败'));
  }, [userPage]);
  useEffect(()=>{if(activeTab==='users')api.permissionAudit(auditPage,20,auditAction).then(p=>{setAuditRows(p.content);setAuditTotalPages(p.totalPages);}).catch(e=>setAdminError(e?.message||'审计日志加载失败'));},[activeTab,auditPage,auditAction]);
  useEffect(()=>{if(activeTab==='users')api.allSessions(sessionPage,20).then(p=>{setSessions(p.content||[]);setSessionTotalPages(p.totalPages||0);}).catch(e=>setAdminError(e?.message||'设备会话加载失败'));},[activeTab,sessionPage]);
  useEffect(()=>{if(activeTab==='users')api.tenants(tenantPage,50).then(p=>{setTenants(p.content||[]);setTenantTotalPages(p.totalPages||0);}).catch(e=>setAdminError(e?.message||'租户加载失败'));},[activeTab,tenantPage]);
  useEffect(()=>{if(activeTab==='users'){api.permissionApprovals().then(setPermissionApprovals).catch(e=>setAdminError(e?.message||'权限审批加载失败'));}},[activeTab]);
  useEffect(() => {
    // Load group membership alongside the personal matrix so administrators
    // can see every effective authorization source without switching tabs.
    if (activeTab !== 'users') return;
    api.permissionGroups().then(rows => {
      const normalized = (rows || []).map((group: any) => ({
        ...group,
        id: Number(group.id),
        version: Number(group.version || 0),
        name: group.name || group.code || '未命名权限组',
        description: group.description || '',
        permissions: (group.permissions || []).map((p: string) => p.replace(/^PERM_/, '')),
        userIds: (group.userIds || group.memberIds || []).map((id: any) => Number(id)),
      }));
      setPermissionGroups(normalized);
      if (selectedPermissionGroup == null && normalized[0]) setSelectedPermissionGroup(normalized[0].id);
    }).catch(e => setAdminError(e?.message || '权限组加载失败'));
  }, [activeTab]);
  useEffect(() => {
    const group = permissionGroups.find(item => item.id === selectedPermissionGroup);
    if (group) {
      setGroupForm({ name: group.name, description: group.description || '' });
      setGroupDirty(false);
    }
  }, [permissionGroups, selectedPermissionGroup]);
  const reloadSessions=()=>api.allSessions(sessionPage,20).then(p=>{setSessions(p.content||[]);setSessionTotalPages(p.totalPages||0);}).catch(e=>setAdminError(e?.message||'设备会话加载失败'));
  const revokeSession=(id:number)=>api.revokeAnySession(id).then(reloadSessions).catch((e:any)=>setSaveStatus({type:'error',message:e.message}));
  const revokeUserSessions=(username:string)=>api.revokeUserSessions(username).then(reloadSessions).catch((e:any)=>setSaveStatus({type:'error',message:e.message}));
  const createTenant=async()=>{try{const t=await api.createTenant(tenantForm);setTenants(v=>[...v,t]);setTenantForm({tenantCode:'',tenantName:''});}catch(e:any){setAdminError(e.message);}};
  const migrateAsset=async(tenantId:number)=>{try{await api.migrateTenantAsset(tenantId,tenantAsset);setSaveStatus({type:'success',message:'资产租户归属已更新'});setTenantAsset('');}catch(e:any){setAdminError(e.message);}};
  const bindTenant=async(userId:number,tenantId:number)=>{try{await api.bindTenantUser(tenantId,userId);setSaveStatus({type:'success',message:'用户租户绑定已更新'});}catch(e:any){setAdminError(e.message);}};
  
  const [dbConfig, setDbConfig] = useState<DatabaseConfig>({
    type: 'mysql',
    host: 'localhost',
    port: 3306,
    username: 'root',
    databaseName: 'slss_prod',
    ssl: false
  });

  const [redisConfig, setRedisConfig] = useState<RedisConfig>({
    enabled: true,
    host: 'localhost',
    port: 6379,
    dbIndex: 0
  });

  // -- System Status Mock State --
  const [sysStatus, setSysStatus] = useState<any>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [systemSettings, setSystemSettings] = useState({ appName: 'SLSS - 服务器全生命周期系统', theme: 'green' as ThemeColor, maintenanceMode: false, logRetentionDays: 90 });
  const [logoValue, setLogoValue] = useState('');
  const [aiChannels, setAiChannels] = useState<any[]>([]);
  const [aiChannelForm, setAiChannelForm] = useState({ id: null as number | null, version: 0, name: '', provider: 'custom', protocol: 'OPENAI_COMPATIBLE', baseUrl: '', model: '', apiKey: '', enabled: true, priority: 100, weight: 100, timeoutMs: 30000 });
  const [aiModelOptions, setAiModelOptions] = useState<string[]>([]);
  const [aiModelsLoading, setAiModelsLoading] = useState(false);

  // -- Feedback State --
  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [isTestLoading, setIsTestLoading] = useState(false);

  // -- Effects --

  // Load system configuration from the backend. Browser storage is only used as a
  // temporary visual fallback while the authenticated API request is in flight.
  useEffect(() => {
    api.systemSettings().then((value: any) => {
      const next = { ...systemSettings, ...value, theme: (value.theme || 'green') as ThemeColor };
      setSystemSettings(next); setTheme(next.theme);
    }).catch((e: any) => setAdminError(e?.message || '系统参数加载失败'));
    api.companyLogo().then((value: any) => setLogoValue(value?.value || '')).catch((e: any) => setAdminError(e?.message || '公司 Logo 加载失败'));
    api.aiChannels().then(setAiChannels).catch((e: any) => setAdminError(e?.message || 'AI 渠道列表加载失败'));
  }, []);

  useEffect(() => {
    if (activeTab !== 'overview') return;
    let disposed = false;
    setOverviewLoading(true);
    api.adminOverview()
      .then(value => { if (!disposed) setAdminOverview(value); })
      .catch((e: any) => { if (!disposed) setAdminError(e?.message || '系统管理概览加载失败'); })
      .finally(() => { if (!disposed) setOverviewLoading(false); });
    return () => { disposed = true; };
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== 'status' && activeTab !== 'database') return;
    let disposed = false;
    const load = () => { setStatusLoading(true); api.systemStatus().then(value => { if (!disposed) setSysStatus(value); }).catch((e: any) => { if (!disposed) setAdminError(e?.message || '系统运行状态加载失败'); }).finally(() => { if (!disposed) setStatusLoading(false); }); };
    load(); const timer = window.setInterval(load, 15000);
    return () => { disposed = true; window.clearInterval(timer); };
  }, [activeTab]);

  // -- Handlers --

  const saveSystemSettings = async () => {
    try {
      const saved = await api.updateSystemSettings(systemSettings);
      setSystemSettings({ ...systemSettings, ...saved, theme: (saved.theme || systemSettings.theme) as ThemeColor });
      setTheme((saved.theme || systemSettings.theme) as ThemeColor);
      window.dispatchEvent(new CustomEvent('slss-system-settings-updated', { detail: saved }));
      setSaveStatus({ type: 'success', message: '基础参数已保存到服务器' });
      window.setTimeout(() => setSaveStatus(null), 3000);
    } catch (e: any) { setSaveStatus({ type: 'error', message: e?.message || '基础参数保存失败' }); }
  };

  const handleLogoImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!/^image\/(png|jpeg|gif|webp)$/.test(file.type)) { setSaveStatus({ type: 'error', message: 'Logo 仅支持 PNG、JPG、GIF 或 WebP' }); return; }
    if (file.size > 2 * 1024 * 1024) { setSaveStatus({ type: 'error', message: 'Logo 文件不能超过 2MB' }); return; }
    const image = new Image(); const url = URL.createObjectURL(file);
    image.onload = async () => {
      URL.revokeObjectURL(url);
      if (image.width < 128 || image.height < 32 || image.width > 2048 || image.height > 1024) { setSaveStatus({ type: 'error', message: `Logo 分辨率 ${image.width}×${image.height} 不符合要求（宽 128-2048px，高 32-1024px）` }); return; }
      const reader = new FileReader(); reader.onload = async () => {
        try { const value = String(reader.result || ''); const saved = await api.updateCompanyLogo(value); setLogoValue(saved.value); setSaveStatus({ type: 'success', message: '公司 Logo 已保存，所有账号刷新后生效' }); } catch (e: any) { setSaveStatus({ type: 'error', message: e?.message || 'Logo 保存失败' }); }
      }; reader.readAsDataURL(file);
    }; image.onerror = () => { URL.revokeObjectURL(url); setSaveStatus({ type: 'error', message: '无法读取 Logo 图片' }); }; image.src = url;
  };

  const testConnection = (target: 'database' | 'redis') => {
    setIsTestLoading(true);
    const started = performance.now();
    api.health().then(() => {
      setSaveStatus({ type: 'success', message: `[${target}] 服务连接正常，延迟 ${Math.round(performance.now() - started)}ms` });
    }).catch((e:any) => {
      setSaveStatus({ type: 'error', message: `[${target}] 连接失败：${e.message}` });
    }).finally(() => { setIsTestLoading(false); setTimeout(() => setSaveStatus(null), 4000); });
  };

  const discoverAiModels = async (id?: number | null) => {
    if (!id) { setSaveStatus({ type: 'error', message: '请先保存渠道，再自动发现模型' }); return; }
    setAiModelsLoading(true);
    try {
      const result = await api.aiChannelModels(id);
      const models = Array.isArray(result?.models) ? result.models.filter((value: unknown): value is string => typeof value === 'string' && value.trim().length > 0) : [];
      setAiModelOptions(models);
      if (models.length && !models.includes(aiChannelForm.model)) setAiChannelForm(previous => ({ ...previous, model: models[0] }));
      setSaveStatus({ type: 'success', message: `已发现 ${models.length} 个可用模型` });
    } catch (e: any) { setSaveStatus({ type: 'error', message: e?.message || '模型发现失败，请检查 API 地址和密钥' }); }
    finally { setAiModelsLoading(false); }
  };
  const applyAiPreset = (preset: typeof AI_CHANNEL_PRESETS[number]) => {
    setAiChannelForm(previous => ({
      ...previous,
      protocol: preset.protocol,
      provider: preset.key === 'openai-compatible' ? 'openai-compatible' : preset.key,
      baseUrl: preset.baseUrl,
      model: preset.model,
    }));
    setAiModelOptions([]);
    setSaveStatus({ type: 'success', message: `已套用「${preset.label}」配置样例，请填写名称和 API Key` });
  };
  const saveAiChannel = async () => {
    try {
      if (!aiChannelForm.name.trim() || !aiChannelForm.baseUrl.trim()) throw new Error('渠道名称和接口地址不能为空');
      const payload = { ...aiChannelForm, provider: aiChannelForm.protocol === 'OPENAI_COMPATIBLE' ? 'openai-compatible' : aiChannelForm.protocol.toLowerCase() };
      let saved = aiChannelForm.id ? await api.updateAiChannel(aiChannelForm.id, payload) : await api.createAiChannel(payload);
      if (saved.id) {
        try {
          const discovered = await api.aiChannelModels(saved.id);
          const firstModel = Array.isArray(discovered?.models) ? discovered.models.find((value: unknown) => typeof value === 'string' && value.trim()) : null;
          // /models persists the first model and increments the optimistic-lock
          // version server-side. Re-read the channel instead of issuing a
          // second PUT with the stale version returned by the initial save.
          const latest = await api.aiChannels();
          saved = latest.find((item: any) => item.id === saved.id) || { ...saved, model: firstModel || saved.model };
        } catch (discoveryError: any) {
          setSaveStatus({ type: 'error', message: `渠道已保存，但模型自动发现失败：${discoveryError?.message || '请稍后重试'}` });
        }
      }
      setAiChannels(previous => aiChannelForm.id ? previous.map(item => item.id === saved.id ? saved : item) : [...previous, saved]);
      setAiChannelForm(previous => ({ ...previous, id: null, version: 0, name: '', baseUrl: '', model: '', apiKey: '' }));
      setAiModelOptions([]);
      setSaveStatus({ type: 'success', message: aiChannelForm.id ? 'AI 渠道配置已更新' : 'AI 渠道已保存，密钥已加密存储' });
    } catch (e: any) { setSaveStatus({ type: 'error', message: e?.message || 'AI 渠道保存失败' }); }
  };
  const testAiChannel = async (id: number) => { try { await api.testAiChannel(id); const latest = await api.aiChannels(); setAiChannels(latest); setSaveStatus({ type: 'success', message: 'AI 渠道连接正常' }); } catch (e: any) { setSaveStatus({ type: 'error', message: e?.message || 'AI 渠道连接失败' }); } };
  const removeAiChannel = async (id: number) => { try { await api.deleteAiChannel(id); setAiChannels(previous => previous.filter(item => item.id !== id)); } catch (e: any) { setSaveStatus({ type: 'error', message: e?.message || 'AI 渠道删除失败' }); } };
  const editAiChannel = (channel: any) => { setAiChannelForm({ id: channel.id, version: channel.version || 0, name: channel.name || '', provider: channel.provider || 'custom', protocol: channel.protocol || 'OPENAI_COMPATIBLE', baseUrl: channel.baseUrl || '', model: channel.model || '', apiKey: '', enabled: channel.enabled !== false, priority: channel.priority ?? 100, weight: channel.weight ?? 100, timeoutMs: channel.timeoutMs ?? 30000 }); setAiModelOptions([]); void discoverAiModels(channel.id); };
  const resetAiChannelForm = () => { setAiChannelForm({ id: null, version: 0, name: '', provider: 'custom', protocol: 'OPENAI_COMPATIBLE', baseUrl: '', model: '', apiKey: '', enabled: true, priority: 100, weight: 100, timeoutMs: 30000 }); setAiModelOptions([]); };

  const togglePermission = (userId: number, perm: Permission) => {
    setPermissionDirty(previous => new Set(previous).add(userId));
    setUsers(users.map(u => {
      if (u.id !== userId) return u;
      const direct = u.personalPermissions || [];
      const hasPerm = direct.includes(perm);
      return {
        ...u,
        personalPermissions: hasPerm ? direct.filter(p => p !== perm) : [...direct, perm]
      };
    }));
  };
  const saveUserPermissions = async (userId: number) => {
    const target = users.find(user => user.id === userId);
    if (!target) return;
    const before = normalizePermissionList(target.personalPermissions || []);
    try {
      {
        const updated = await api.updateUserPermissions(userId, target.personalPermissions || []);
        const after = normalizePermissionList(updated.personalPermissions || target.personalPermissions);
        setUsers(previous => previous.map(user => user.id === userId ? { ...user, permissions: normalizePermissionList(updated.permissions || target.permissions), personalPermissions: after, permissionGroupIds: (updated.permissionGroupIds || user.permissionGroupIds || []).map((id:any) => Number(id)), permissionSources: updated.permissionSources || user.permissionSources } : user));
        setPermissionDiff({ username: target.username, added: after.filter(permission => !before.includes(permission)), removed: before.filter(permission => !after.includes(permission)) });
      }
      setPermissionDirty(previous => { const next = new Set(previous); next.delete(userId); return next; });
      setSaveStatus({ type: 'success', message: `用户 ${target.username} 的权限已保存` });
    } catch (error: any) { setSaveStatus({ type: 'error', message: error.message || '权限保存失败' }); }
  };
  const toggleGroupPermission = (permission: Permission) => {
    if (selectedPermissionGroup == null) return;
    setPermissionGroups(previous => previous.map(group => {
      if (group.id !== selectedPermissionGroup) return group;
      const current = Array.isArray(group.permissions) ? group.permissions : [];
      return { ...group, permissions: current.includes(permission) ? current.filter((p: string) => p !== permission) : [...current, permission] };
    }));
    setGroupDirty(true);
  };
  const toggleGroupMember = (userId: number) => {
    if (selectedPermissionGroup == null) return;
    setPermissionGroups(previous => previous.map(group => {
      if (group.id !== selectedPermissionGroup) return group;
      const current = Array.isArray(group.userIds) ? group.userIds : [];
      return { ...group, userIds: current.includes(userId) ? current.filter((id: number) => id !== userId) : [...current, userId] };
    }));
    setGroupDirty(true);
  };
  const toggleVisibleGroupMembers = (checked: boolean) => {
    if (selectedPermissionGroup == null) return;
    const visibleIds = users
      .filter(user => user.username.toLowerCase().includes(groupMemberSearch.trim().toLowerCase()))
      .map(user => user.id);
    setPermissionGroups(previous => previous.map(group => {
      if (group.id !== selectedPermissionGroup) return group;
      const current = new Set<number>(group.userIds || []);
      visibleIds.forEach(id => checked ? current.add(id) : current.delete(id));
      return { ...group, userIds: Array.from(current) };
    }));
    setGroupDirty(true);
  };
  const openPermissionDetail = async (user: User) => {
    try { setPermissionDetail(await api.permissionDetail(user.id)); } catch (e: any) { setAdminError(e?.message || '权限详情加载失败'); }
  };
  const simulateUserPermissions = async (user: User) => {
    try { setPermissionSimulation(await api.simulatePermissions(user.username)); } catch (e: any) { setAdminError(e?.message || '权限模拟失败'); }
  };
  const savePermissionGroup = async () => {
    const group = permissionGroups.find(item => item.id === selectedPermissionGroup);
    if (!group) return;
    if (!groupForm.name.trim()) { setAdminError('权限组名称不能为空'); return; }
    try {
      const normalized = await api.updatePermissionGroupAggregate(group.id, { name: groupForm.name.trim(), description: groupForm.description.trim(), enabled: group.enabled !== false, permissions: group.permissions || [], userIds: group.userIds || [], version: group.version });
      setPermissionGroups(previous => previous.map(item => item.id === group.id ? normalized : item));
      setGroupDirty(false);
      setSaveStatus({ type: 'success', message: `权限组“${normalized.name}”已保存` });
    } catch (e: any) { setSaveStatus({ type: 'error', message: e?.message || '权限组保存失败' }); }
  };
  const createPermissionGroup = async () => {
    if (!groupForm.name.trim()) { setAdminError('请输入权限组名称'); return; }
    try {
      const group = await api.createPermissionGroup({ name: groupForm.name.trim(), description: groupForm.description.trim() });
      const normalized = { ...group, id: Number(group.id), version: Number(group.version || 0), name: group.name || groupForm.name.trim(), description: group.description || groupForm.description.trim(), permissions: [], userIds: [] };
      setPermissionGroups(previous => [...previous, normalized]);
      setSelectedPermissionGroup(normalized.id);
      setGroupForm({ name: '', description: '' });
      setGroupCreateDialog(false);
      setPermissionView('groups');
    } catch (e: any) { setAdminError(e?.message || '权限组创建失败'); }
  };
  const deletePermissionGroup = async () => {
    const group = permissionGroups.find(item => item.id === selectedPermissionGroup);
    if (!group || !window.confirm(`确认删除权限组“${group.name}”？成员不会被删除。`)) return;
    try {
      await api.deletePermissionGroup(group.id);
      const remaining = permissionGroups.filter(item => item.id !== group.id);
      setPermissionGroups(remaining); setSelectedPermissionGroup(remaining[0]?.id ?? null);
      setSaveStatus({ type: 'success', message: '权限组已删除' });
    } catch (e: any) { setAdminError(e?.message || '权限组删除失败'); }
  };

  const createRemoteUser = async () => {
    if (credentialForm.username.trim().length < 3 || credentialForm.password.length < 8) { setAdminError('用户名至少需要 3 个字符，初始密码至少 8 位'); return; }
    try { const created = await api.createUser({ username:credentialForm.username.trim(), password:credentialForm.password, roles: [credentialForm.role] }); setUsers(prev => [...prev, { id: created.id, username: created.username, role: credentialForm.role as UserRole, permissions: normalizePermissionList(created.permissions), personalPermissions: normalizePermissionList(created.personalPermissions), permissionGroupIds: (created.permissionGroupIds || []).map((id:any) => Number(id)), status: 'active', mustChangePassword: false } as User]); setSaveStatus({type:'success',message:'用户创建成功'}); setUserDialog(null); } catch (e:any) { setAdminError(e.message); }
  };
  const deleteRemoteUser = async (u: User) => {
    if (!window.confirm(`确认删除账号 ${u.username}？删除后不可恢复。`)) return;
    try { await api.deleteUser(u.id); setUsers(prev => prev.filter(x => x.id !== u.id)); setSaveStatus({type:'success',message:`账号 ${u.username} 已删除`}); } catch(e:any) { setSaveStatus({type:'error',message:e.message}); }
  };
  const updateRemoteUser = async (u: User) => {
    if (credentialForm.username.trim().length < 3) { setAdminError('用户名至少需要 3 个字符'); return; }
    if (credentialForm.password && credentialForm.password.length < 8) { setAdminError('密码至少 8 位'); return; }
    try { const updated = await api.updateUser(u.id, { username: credentialForm.username.trim(), password: credentialForm.password || null, roles: [credentialForm.role] }); setUsers(prev => prev.map(x => x.id === u.id ? { ...x, username: updated.username, role: credentialForm.role as UserRole, permissions: normalizePermissionList(updated.permissions || x.permissions), personalPermissions: normalizePermissionList(updated.personalPermissions || x.personalPermissions), permissionGroupIds: (updated.permissionGroupIds || x.permissionGroupIds || []).map((id:any) => Number(id)) } as User : x)); setSaveStatus({type:'success',message:'用户信息已修改'}); setUserDialog(null); } catch(e:any) { setAdminError(e.message); }
  };

  // -- Renders --

  const SidebarItem = ({ id, icon: Icon, label }: { id: typeof activeTab, icon: any, label: string }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`w-full flex items-center px-4 py-3 text-sm font-medium transition-colors rounded-lg mb-1 ${
        activeTab === id 
          ? `${themeConfig.classes.bgLight} ${themeConfig.classes.text}` 
          : 'text-gray-600 hover:bg-gray-50'
      }`}
    >
      <Icon className="w-5 h-5 mr-3" />
      {label}
    </button>
  );

  const visiblePermissionEntries = Object.entries(PERMISSION_LABELS).filter(([key, label]) => {
    const inDomain = permissionDomain === 'all' || (PERMISSION_DOMAINS[permissionDomain] || []).includes(key as Permission);
    const query = permissionSearch.trim().toLowerCase();
    const matchesSearch = !query || key.toLowerCase().includes(query) || label.toLowerCase().includes(query);
    const hasAuthorization = users.some(user => (user.permissions || []).includes(key as Permission));
    return inDomain && matchesSearch && (!authorizedOnly || hasAuthorization);
  });

  return (
    <div className="slss-admin-page flex flex-col gap-6 md:flex-row min-h-[calc(100vh-100px)]">
      
      {/* Sidebar Settings Menu */}
      <div className="w-full md:w-64 flex-shrink-0">
        <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
          <h2 className="text-xs font-bold text-gray-400 uppercase mb-4 px-4 tracking-wider">系统设置</h2>
          <nav>
            <SidebarItem id="overview" icon={Activity} label="管理概览" />
            <SidebarItem id="status" icon={Activity} label="系统监控概览" />
            <SidebarItem id="database" icon={Database} label="数据库与缓存" />
            <SidebarItem id="ai" icon={Network} label="AI 智能网关" />
            <SidebarItem id="users" icon={UserCheck} label="用户权限管理" />
            <SidebarItem id="general" icon={Settings} label="基础参数设置" />
          </nav>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1">
        <div className="bg-white rounded-lg shadow border border-gray-200 min-h-full">
          
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50/50 flex justify-between items-center">
             <h1 className="text-xl font-bold text-gray-800 flex items-center">
               {activeTab === 'overview' && <><Activity className={`mr-2 ${themeConfig.classes.text}`} /> 管理概览</>}
               {activeTab === 'status' && <><Activity className={`mr-2 ${themeConfig.classes.text}`} /> 系统运行状态</>}
               {activeTab === 'database' && <><Database className={`mr-2 ${themeConfig.classes.text}`} /> 数据源连接配置</>}
               {activeTab === 'ai' && <><Network className="mr-2 text-purple-600" /> AI 模型服务渠道</>}
               {activeTab === 'users' && <><UserCheck className={`mr-2 ${themeConfig.classes.text}`} /> 人员授权与安全</>}
               {activeTab === 'general' && <><Settings className="mr-2 text-gray-600" /> 基础系统参数</>}
             </h1>
             
             {/* Global Status Message */}
             {saveStatus && (
                <div className={`px-4 py-2 rounded text-sm font-medium animate-in fade-in slide-in-from-top-2 flex items-center ${
                  saveStatus.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  {saveStatus.type === 'success' ? <CheckCircle className="w-4 h-4 mr-2"/> : <AlertCircle className="w-4 h-4 mr-2"/>}
                  {saveStatus.message}
                </div>
             )}
          </div>

          <div className="p-6">

            {adminError && (
              <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <div><div className="font-semibold">管理接口请求失败</div><div className="mt-1 break-words">{adminError}</div></div>
                <button className="ml-auto text-red-700" onClick={() => setAdminError('')} aria-label="关闭错误提示"><X className="h-4 w-4" /></button>
              </div>
            )}

            {activeTab === 'overview' && (
              <div className="space-y-6" data-testid="admin-overview">
                {overviewLoading && <div className="rounded-xl border border-[var(--theme-primary-border)] bg-[var(--theme-primary-soft)] px-4 py-3 text-sm" style={{ color: 'var(--theme-primary-strong)' }}>正在读取系统管理概览…</div>}
                {!overviewLoading && !adminOverview && <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">暂无概览数据，请确认当前账号具有系统管理权限。</div>}
                {adminOverview && <>
                  <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-6 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Administration Control Center</p><h2 className="mt-2 text-2xl font-semibold text-slate-900">{adminOverview.application?.appName}</h2><p className="mt-1 text-sm text-slate-500">版本 {adminOverview.application?.version} · 主题 {adminOverview.application?.theme} · {adminOverview.application?.maintenanceMode ? '维护模式' : '正常运行'}</p></div>
                      <span className="rounded-full border border-[var(--theme-primary-border)] bg-[var(--theme-primary-soft)] px-3 py-1 text-xs font-semibold" style={{ color: 'var(--theme-primary-strong)' }}>配置中心</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
                    {[['用户', adminOverview.counts?.users], ['权限组', adminOverview.counts?.permissionGroups], ['租户', adminOverview.counts?.tenants], ['AI 渠道', adminOverview.counts?.aiChannels], ['启用渠道', adminOverview.counts?.enabledAiChannels]].map(([label, value]) => <div key={String(label)} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-3xl font-semibold text-slate-900">{value ?? '—'}</p></div>)}
                  </div>
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <button onClick={() => setActiveTab('database')} className="rounded-xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--theme-primary-border)]"><p className="text-sm font-semibold text-slate-900">连接与依赖</p><p className="mt-1 text-sm text-slate-500">查看 MySQL、Redis 与运行时健康状态</p></button>
                    <button onClick={() => setActiveTab('users')} className="rounded-xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--theme-primary-border)]"><p className="text-sm font-semibold text-slate-900">身份与权限</p><p className="mt-1 text-sm text-slate-500">管理用户、权限组、租户和授权审计</p></button>
                    <button onClick={() => setActiveTab('ai')} className="rounded-xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--theme-primary-border)]"><p className="text-sm font-semibold text-slate-900">AI 智能网关</p><p className="mt-1 text-sm text-slate-500">配置渠道、模型发现与连通性测试</p></button>
                    <button onClick={() => setActiveTab('general')} className="rounded-xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--theme-primary-border)]"><p className="text-sm font-semibold text-slate-900">品牌与系统参数</p><p className="mt-1 text-sm text-slate-500">统一维护系统名称、主题外观与 Logo</p></button>
                  </div>
                </>}
              </div>
            )}
            
            {/* --- TAB: SYSTEM STATUS --- */}
            {activeTab === 'status' && (
              <div className="space-y-6">
                 {statusLoading && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">正在读取后端运行状态…</div>}
                 {!sysStatus && !statusLoading && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">无法读取后端运行状态，请检查接口与数据库连接。</div>}
                 <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                      <p className="text-xs text-blue-500 uppercase font-bold">运行时间 (Uptime)</p>
                      <p className="text-2xl font-mono text-blue-900 mt-1">{sysStatus ? `${(Number(sysStatus.uptimeSeconds || 0) / 3600).toFixed(1)} hrs` : '—'}</p>
                    </div>
                    <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100">
                      <p className="text-xs text-indigo-500 uppercase font-bold">活跃连接数</p>
                      <p className="text-2xl font-mono text-indigo-900 mt-1">{sysStatus?.database?.activeConnections ?? '—'}</p>
                    </div>
                    <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-100">
                      <p className="text-xs text-emerald-600 uppercase font-bold">数据库状态</p>
                      <div className="flex items-center mt-1">
                        <StatusIndicator status={sysStatus?.database?.status === 'connected' ? 'good' : 'error'} text={sysStatus?.database?.status === 'connected' ? 'Connected' : (sysStatus?.database?.status || 'Unknown')} />
                        <span className="ml-2 text-xs text-gray-500">({sysStatus?.database?.latencyMs ?? '—'}ms)</span>
                      </div>
                    </div>
                    <div className="bg-orange-50 p-4 rounded-lg border border-orange-100">
                      <p className="text-xs text-orange-600 uppercase font-bold">Redis 缓存</p>
                      <div className="mt-1">
                        <StatusIndicator 
                          status={sysStatus?.redis?.status === 'connected' ? 'good' : 'error'}
                          text={sysStatus?.redis?.status || 'Unknown'}
                        />
                      </div>
                    </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="border border-gray-200 rounded-lg p-4">
                     <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center"><Server className="w-4 h-4 mr-2"/> CPU 负载</h3>
                     <div className="relative pt-1">
                       <div className="flex mb-2 items-center justify-between">
                         <div><span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-blue-600 bg-blue-200">Load</span></div>
                         <div className="text-right"><span className="text-xs font-semibold inline-block text-blue-600">{sysStatus?.jvm?.systemLoadAverage ?? '—'}</span></div>
                       </div>
                       <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-blue-100">
                         <div style={{ width: `${Math.min(100, Number(sysStatus?.jvm?.systemLoadAverage || 0) * 100)}%` }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-blue-500 transition-all duration-500"></div>
                       </div>
                     </div>
                   </div>

                   <div className="border border-gray-200 rounded-lg p-4">
                     <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center"><HardDrive className="w-4 h-4 mr-2"/> 内存使用率</h3>
                     <div className="relative pt-1">
                       <div className="flex mb-2 items-center justify-between">
                         <div><span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-purple-600 bg-purple-200">RAM</span></div>
                         <div className="text-right"><span className="text-xs font-semibold inline-block text-purple-600">{sysStatus?.jvm?.memoryUsagePercent ?? '—'}%</span></div>
                       </div>
                       <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-purple-100">
                         <div style={{ width: `${Math.min(100, Number(sysStatus?.jvm?.memoryUsagePercent || 0))}%` }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-purple-500 transition-all duration-500"></div>
                       </div>
                     </div>
                   </div>
                 </div>
              </div>
            )}

            {/* --- TAB: DATABASE --- */}
            {activeTab === 'database' && (
              <div className="space-y-8 animate-in fade-in">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
                    <div className="flex items-center justify-between"><h3 className="font-semibold text-emerald-900">MySQL 实时连接</h3><StatusIndicator status={sysStatus?.database?.status === 'connected' ? 'good' : 'error'} text={sysStatus?.database?.status || '未检测'} /></div>
                    <p className="mt-3 text-sm text-emerald-800">{sysStatus?.database?.product || '等待后端检测'} · 延迟 {sysStatus?.database?.latencyMs ?? '—'} ms</p>
                    <p className="mt-1 text-xs text-emerald-700">连接池：{sysStatus?.database?.activeConnections ?? '—'} 活跃 / {sysStatus?.database?.totalConnections ?? '—'} 总数</p>
                    {sysStatus?.database?.error && <p className="mt-2 text-xs text-red-700">{sysStatus.database.error}</p>}
                  </div>
                  <div className="rounded-xl border border-orange-200 bg-orange-50 p-5">
                    <div className="flex items-center justify-between"><h3 className="font-semibold text-orange-900">Redis 缓存连接</h3><StatusIndicator status={sysStatus?.redis?.status === 'connected' ? 'good' : 'error'} text={sysStatus?.redis?.status || '未检测'} /></div>
                    <p className="mt-3 text-sm text-orange-800">实时 PING 延迟 {sysStatus?.redis?.latencyMs ?? '—'} ms</p>
                    <p className="mt-1 text-xs text-orange-700">缓存不可用时，异步任务将按降级策略运行。</p>
                    {sysStatus?.redis?.error && <p className="mt-2 text-xs text-red-700">{sysStatus.redis.error}</p>}
                  </div>
                </div>
                {/* Main DB Config */}
                <div>
                   <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                     <Database className="w-5 h-5 mr-2" /> 主数据库配置 (Primary Database)
                   </h3>
                   <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-600">以下为打包时读取的连接参数，仅供参考。实际连接由 Tomcat 配置文件控制，修改后请更新服务器配置并重启应用。</div>
                   <div className="pointer-events-none grid grid-cols-1 md:grid-cols-2 gap-6 opacity-70">
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700">数据库类型</label>
                        <select 
                          className={`mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-2 ${themeConfig.classes.ring} sm:text-sm rounded-md border`}
                          value={dbConfig.type}
                          onChange={(e) => setDbConfig({...dbConfig, type: e.target.value as any})}
                        >
                          <option value="mysql">MySQL (Recommended)</option>
                          <option value="postgres">PostgreSQL</option>
                          <option value="oracle">Oracle Database</option>
                          <option value="sqlite">SQLite (Local File)</option>
                        </select>
                      </div>

                      {dbConfig.type === 'sqlite' ? (
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700">数据库文件路径</label>
                          <input 
                            type="text" 
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" 
                            value={dbConfig.filePath}
                            placeholder="./data/slss.db"
                            onChange={(e) => setDbConfig({...dbConfig, filePath: e.target.value})}
                          />
                        </div>
                      ) : (
                        <>
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Host Address</label>
                            <input 
                              type="text" className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                              value={dbConfig.host}
                              onChange={(e) => setDbConfig({...dbConfig, host: e.target.value})}
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Port</label>
                            <input 
                              type="number" className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                              value={dbConfig.port}
                              onChange={(e) => setDbConfig({...dbConfig, port: parseInt(e.target.value)})}
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Username</label>
                            <input 
                              type="text" className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                              value={dbConfig.username}
                              onChange={(e) => setDbConfig({...dbConfig, username: e.target.value})}
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Password</label>
                            <input 
                              type="password" className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                              value={dbConfig.password}
                              onChange={(e) => setDbConfig({...dbConfig, password: e.target.value})}
                            />
                          </div>
                          <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700">Database Name / SID</label>
                            <input 
                              type="text" className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                              value={dbConfig.databaseName}
                              onChange={(e) => setDbConfig({...dbConfig, databaseName: e.target.value})}
                            />
                          </div>
                        </>
                      )}
                   </div>
                   
                   <div className="mt-4 flex space-x-4">
                     <p className="rounded-lg bg-slate-50 px-4 py-2 text-xs text-slate-600">运行时连接参数由 Tomcat 的 `WEB-INF/classes/jdbc.properties` 与环境配置管理，此处不再保存到浏览器，避免显示与实际连接不一致。</p>
                     <button 
                        onClick={() => testConnection('database')}
                        disabled={isTestLoading}
                        className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded shadow-sm hover:bg-gray-50 flex items-center disabled:opacity-50"
                     >
                       {isTestLoading ? <RefreshCw className="w-4 h-4 mr-2 animate-spin"/> : <Activity className="w-4 h-4 mr-2" />} 
                       测试连接
                     </button>
                   </div>
                </div>
                {!USE_MOCK_DATA && <div className="mt-8"><div className="flex justify-between mb-3"><h3 className="font-semibold">安全审计日志</h3><input value={auditAction} onChange={e=>{setAuditAction(e.target.value);setAuditPage(0);}} placeholder="按操作类型筛选" className="border rounded px-2 py-1 text-sm"/></div><div className="overflow-x-auto border rounded"><table className="min-w-full text-sm"><thead className="bg-gray-50"><tr><th className="p-2 text-left">时间</th><th className="p-2 text-left">用户</th><th className="p-2 text-left">操作</th><th className="p-2 text-left">目标</th><th className="p-2 text-left">结果</th><th className="p-2 text-left">详情</th></tr></thead><tbody>{auditRows.map(r=><tr key={r.id} className="border-t"><td className="p-2">{new Date(r.createdAt).toLocaleString()}</td><td className="p-2">{r.actor||'system'}</td><td className="p-2">{r.action}</td><td className="p-2">{r.targetType}:{r.targetId}</td><td className={`p-2 ${r.success?'text-green-600':'text-red-600'}`}>{r.success?'成功':'失败'}</td><td className="p-2">{r.details||'-'}</td></tr>)}</tbody></table></div><div className="flex justify-end gap-2 mt-3"><button disabled={auditPage===0} onClick={()=>setAuditPage(p=>p-1)} className="border px-3 py-1 rounded disabled:opacity-40">上一页</button><span>{auditPage+1}/{Math.max(auditTotalPages,1)}</span><button disabled={auditPage+1>=auditTotalPages} onClick={()=>setAuditPage(p=>p+1)} className="border px-3 py-1 rounded disabled:opacity-40">下一页</button></div></div>}
                {!USE_MOCK_DATA && <div className="mt-8 rounded-xl border border-violet-200 bg-violet-50 p-5"><div className="flex items-center justify-between"><div><h3 className="font-semibold text-violet-900">权限变更审批</h3><p className="mt-1 text-xs text-violet-700">审批通过后才会写入 DENY/ALLOW 覆盖规则，所有操作都会进入审计日志。</p></div><span className="rounded-full bg-white px-2 py-1 text-xs text-violet-700">待处理 {permissionApprovals.length}</span></div>{permissionApprovals.length===0?<p className="mt-4 text-xs text-violet-600">暂无待处理审批</p>:<div className="mt-4 space-y-2">{permissionApprovals.map(item=><div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-violet-100 bg-white p-3 text-xs"><div><b>{item.requestedBy}</b> 请求 {item.changeType} · {item.targetType}#{item.targetId}<div className="mt-1 text-slate-500">{item.payloadJson}</div></div><div className="flex gap-2"><button onClick={async()=>{try{await api.reviewPermissionApproval(item.id,{decision:'APPROVED',comment:''});setPermissionApprovals(v=>v.filter(x=>x.id!==item.id));}catch(e:any){setAdminError(e.message);}}} className="rounded bg-emerald-600 px-2 py-1 text-white">批准</button><button onClick={async()=>{try{await api.reviewPermissionApproval(item.id,{decision:'REJECTED',comment:''});setPermissionApprovals(v=>v.filter(x=>x.id!==item.id));}catch(e:any){setAdminError(e.message);}}} className="rounded bg-rose-600 px-2 py-1 text-white">拒绝</button></div></div>)}</div>}</div>}
              </div>
            )}

            {/* --- TAB: AI CONFIG --- */}
            {activeTab === 'ai' && (
              <div className="space-y-6 animate-in fade-in">
                <div className="max-w-3xl">
                  <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                    <Network className="w-5 h-5 text-purple-600 mr-2" />
                    AI 渠道管理 (Channel Management)
                  </h3>

                  <section className="mb-6 rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 via-white to-cyan-50 p-5 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3"><div><h4 className="font-semibold text-violet-950">AI 渠道中心</h4><p className="mt-1 text-xs text-slate-600">多供应商统一接入 · 优先级故障转移 · 权重路由 · 服务端加密密钥</p></div><span className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-700">{aiChannels.filter(c => c.enabled !== false).length}/{aiChannels.length} 已启用</span></div>
                    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4"><div className="rounded-xl bg-white/80 p-3"><p className="text-[11px] text-slate-500">渠道总数</p><p className="mt-1 text-xl font-bold text-slate-900">{aiChannels.length}</p></div><div className="rounded-xl bg-white/80 p-3"><p className="text-[11px] text-slate-500">在线渠道</p><p className="mt-1 text-xl font-bold text-emerald-600">{aiChannels.filter(c => c.lastStatus === 'UP').length}</p></div><div className="rounded-xl bg-white/80 p-3"><p className="text-[11px] text-slate-500">故障渠道</p><p className="mt-1 text-xl font-bold text-rose-600">{aiChannels.filter(c => c.lastStatus === 'DOWN').length}</p></div><div className="rounded-xl bg-white/80 p-3"><p className="text-[11px] text-slate-500">路由策略</p><p className="mt-1 text-sm font-bold text-violet-700">优先级 + 权重</p></div></div>
                    <div className="mt-4 space-y-2">{aiChannels.length === 0 ? <div className="rounded-xl border border-dashed border-violet-200 bg-white/70 px-4 py-8 text-center text-xs text-slate-500">尚未配置 AI 渠道，请从下方添加 OpenAI、Anthropic、Gemini 或自定义兼容接口。</div> : aiChannels.map((channel, index) => <div key={channel.id} className="rounded-xl border border-white bg-white px-3 py-3 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><span className={`h-2.5 w-2.5 shrink-0 rounded-full ${channel.enabled === false ? 'bg-slate-300' : channel.lastStatus === 'UP' ? 'bg-emerald-500' : channel.lastStatus === 'DOWN' ? 'bg-red-500' : 'bg-amber-400'}`} /><div className="min-w-0"><p className="truncate font-semibold text-slate-800">{index + 1}. {channel.name} <span className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">{channel.protocol}</span>{channel.enabled === false && <span className="ml-1 text-[10px] text-slate-400">已停用</span>}</p><p className="truncate text-xs text-slate-500">{channel.baseUrl} · {channel.model}</p></div></div><div className="flex items-center gap-1.5"><span className="rounded bg-slate-50 px-2 py-1 text-[10px] text-slate-500">P{channel.priority} / W{channel.weight}</span><button onClick={() => testAiChannel(channel.id)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:border-violet-400 hover:text-violet-700">测试</button><button onClick={() => editAiChannel(channel)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:border-violet-400 hover:text-violet-700">编辑</button><button onClick={() => removeAiChannel(channel.id)} className="rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50">删除</button></div></div>{channel.lastError && <p className="mt-2 rounded bg-rose-50 px-2 py-1.5 text-[11px] text-rose-700">最近错误：{channel.lastError}</p>}</div>)}</div>
                    <div className="mt-5 rounded-xl border border-violet-100 bg-white/80 p-4"><div className="mb-3 flex items-center justify-between"><div><h5 className="text-sm font-semibold text-slate-800">{aiChannelForm.id ? '编辑渠道' : '添加渠道'}</h5><p className="text-[11px] text-slate-500">支持标准协议和任意 OpenAI Compatible 自定义网关。</p></div>{aiChannelForm.id && <button onClick={resetAiChannelForm} className="text-xs text-slate-500 hover:text-violet-700">取消编辑</button>}</div><div className="mb-3 rounded-lg border border-cyan-100 bg-cyan-50/70 p-3"><div className="flex flex-wrap items-center gap-2"><span className="text-xs font-semibold text-cyan-900">配置样例</span><select defaultValue="" onChange={e => { const preset = AI_CHANNEL_PRESETS.find(item => item.key === e.target.value); if (preset) applyAiPreset(preset); }} className="rounded-md border border-cyan-200 bg-white px-2 py-1.5 text-xs text-cyan-900"><option value="">选择 API 类型自动填充示例</option>{AI_CHANNEL_PRESETS.map(preset => <option key={preset.key} value={preset.key}>{preset.label}</option>)}</select></div><p className="mt-2 text-[11px] leading-5 text-cyan-800">Base URL 只填写服务根地址（例如 <code>https://api.example.com/v1</code>），系统会自动请求 <code>/models</code> 和 <code>/chat/completions</code>；不要把 <code>/models</code> 直接填入 Base URL。</p></div><div className="grid gap-2 md:grid-cols-2"><input value={aiChannelForm.name} onChange={e => setAiChannelForm({ ...aiChannelForm, name: e.target.value })} placeholder="渠道名称，如：生产 AI 主链路" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" /><select value={aiChannelForm.protocol} onChange={e => setAiChannelForm({ ...aiChannelForm, protocol: e.target.value })} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"><option value="OPENAI_COMPATIBLE">OpenAI Compatible（OpenAI / DeepSeek / 通义等）</option><option value="ANTHROPIC">Anthropic Messages</option><option value="GEMINI">Google Gemini</option><option value="CUSTOM">Custom API</option></select><input value={aiChannelForm.baseUrl} onChange={e => setAiChannelForm({ ...aiChannelForm, baseUrl: e.target.value })} placeholder="Base URL / API 地址（不含 /models）" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-mono" /><input value={aiChannelForm.model} onChange={e => setAiChannelForm({ ...aiChannelForm, model: e.target.value })} placeholder="默认模型名称（可留空，保存后自动发现）" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" /><input type="password" value={aiChannelForm.apiKey} onChange={e => setAiChannelForm({ ...aiChannelForm, apiKey: e.target.value })} placeholder={aiChannelForm.id ? '留空则保留原 API Key' : 'API Key（服务端加密保存）'} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-mono md:col-span-2" /><div className="grid grid-cols-3 gap-2 md:col-span-2"><label className="text-[11px] text-slate-500">优先级<input type="number" min="0" max="10000" value={aiChannelForm.priority} onChange={e => setAiChannelForm({ ...aiChannelForm, priority: Number(e.target.value) })} className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 text-sm" /></label><label className="text-[11px] text-slate-500">权重<input type="number" min="1" max="10000" value={aiChannelForm.weight} onChange={e => setAiChannelForm({ ...aiChannelForm, weight: Number(e.target.value) })} className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 text-sm" /></label><label className="text-[11px] text-slate-500">超时(ms)<input type="number" min="1000" max="300000" value={aiChannelForm.timeoutMs} onChange={e => setAiChannelForm({ ...aiChannelForm, timeoutMs: Number(e.target.value) })} className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 text-sm" /></label></div><label className="inline-flex items-center gap-2 text-xs text-slate-600 md:col-span-2"><input type="checkbox" checked={aiChannelForm.enabled} onChange={e => setAiChannelForm({ ...aiChannelForm, enabled: e.target.checked })} />启用该渠道（未启用渠道不会参与路由）</label><div className="flex gap-2 md:col-span-2"><button onClick={saveAiChannel} className="theme-accent-bg rounded-lg px-4 py-2 text-sm font-semibold">{aiChannelForm.id ? '保存渠道修改' : '新增 AI 渠道'}</button>{!aiChannelForm.id && <button onClick={resetAiChannelForm} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600">重置</button>}</div></div></div>
                  {aiChannelForm.id && aiModelOptions.length > 0 && <div className="mb-6 rounded-xl border border-cyan-100 bg-cyan-50/60 p-3"><div className="flex items-center justify-between"><p className="text-xs font-semibold text-cyan-900">已发现模型（点击填入当前渠道）</p><button type="button" disabled={aiModelsLoading} onClick={() => discoverAiModels(aiChannelForm.id)} className="text-[11px] text-cyan-700 hover:underline disabled:opacity-50">{aiModelsLoading ? '刷新中…' : '刷新模型'}</button></div><div className="mt-2 flex flex-wrap gap-1.5">{aiModelOptions.map(model => <button type="button" key={model} onClick={() => setAiChannelForm(previous => ({ ...previous, model }))} className={`rounded-full border px-2.5 py-1 text-[11px] transition ${aiChannelForm.model === model ? 'border-cyan-500 bg-cyan-600 text-white' : 'border-cyan-200 bg-white text-cyan-800 hover:bg-cyan-100'}`}>{model}</button>)}</div></div>}
                    <div className="mt-3 rounded-lg border border-dashed border-violet-200 bg-violet-50/60 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs font-semibold text-violet-800">模型自动发现</p><p className="text-[11px] text-violet-600">保存渠道后从 /models 获取远端模型，避免写死模型名称。</p></div><button type="button" disabled={!aiChannelForm.id || aiModelsLoading} onClick={() => discoverAiModels(aiChannelForm.id)} className="rounded-lg bg-violet-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40">{aiModelsLoading ? '发现中…' : '发现模型'}</button></div>{aiModelOptions.length > 0 && <select value={aiChannelForm.model} onChange={e => setAiChannelForm({ ...aiChannelForm, model: e.target.value })} className="mt-2 w-full rounded-lg border border-violet-200 bg-white px-3 py-2 text-sm"><option value="">选择默认模型</option>{aiModelOptions.map(model => <option key={model} value={model}>{model}</option>)}</select>}</div>
                  </section>
                </div>
              </div>
            )}

            {/* --- TAB: USERS --- */}
            {activeTab === 'users' && (
              <div className="animate-in fade-in">
                {adminError && <div role="alert" className="mb-4 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><span>{adminError}</span><button onClick={()=>setAdminError('')} aria-label="关闭错误提示"><X className="h-4 w-4"/></button></div>}
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium text-gray-900">用户权限矩阵</h3>
                  <div className="flex items-center gap-2">
                    <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1" role="tablist" aria-label="授权范围">
                      <button type="button" onClick={() => setPermissionView('users')} className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${permissionView === 'users' ? 'bg-white text-cyan-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`} role="tab" aria-selected={permissionView === 'users'}>个人授权</button>
                      <button type="button" onClick={() => setPermissionView('groups')} className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${permissionView === 'groups' ? 'bg-white text-cyan-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`} role="tab" aria-selected={permissionView === 'groups'}>群组授权</button>
                    </div>
                    {permissionView === 'users' ? <button onClick={()=>{setAdminError('');setCredentialForm({username:'',password:'',role:'TECHNICIAN'});setUserDialog({mode:'create'});}} className={`text-sm ${themeConfig.classes.text} hover:underline ${themeConfig.classes.bgLight} px-3 py-1 rounded`}>+ 新增用户</button> : <button onClick={()=>{setAdminError('');setGroupForm({name:'',description:''});setGroupCreateDialog(true);}} className="rounded-lg bg-cyan-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-800">+ 新建权限组</button>}
                  </div>
                </div>
                {permissionView === 'groups' ? (
                  <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
                    <aside className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="mb-2 flex items-center justify-between"><span className="text-xs font-semibold uppercase tracking-wide text-slate-500">权限组</span>{permissionGroups.length > 0 && <span className="text-[11px] text-slate-400">{permissionGroups.length} 个</span>}</div>
                      {permissionGroups.length === 0 ? <div className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-center text-xs text-slate-500">暂无权限组，请先新建</div> : <div className="space-y-1">{permissionGroups.map(group => <button type="button" key={group.id} onClick={() => setSelectedPermissionGroup(group.id)} className={`w-full rounded-lg px-3 py-2 text-left transition ${selectedPermissionGroup === group.id ? 'bg-cyan-100 text-cyan-800 ring-1 ring-cyan-300' : 'bg-white text-slate-700 hover:bg-cyan-50'}`}><div className="truncate text-sm font-semibold">{group.name}</div><div className="mt-0.5 text-[11px] text-slate-500">{(group.userIds || []).length} 名成员 · {(group.permissions || []).length} 项权限</div></button>)}</div>}
                    </aside>
                    <section className="rounded-xl border border-slate-200 bg-white p-4">
                      {!selectedPermissionGroup ? <div className="py-12 text-center text-sm text-slate-500">请选择或创建一个权限组</div> : <>
                        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3"><div className="min-w-[260px] flex-1"><input value={groupForm.name} onChange={e => { setGroupForm({ ...groupForm, name: e.target.value }); setGroupDirty(true); }} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800" placeholder="权限组名称"/><input value={groupForm.description} onChange={e => { setGroupForm({ ...groupForm, description: e.target.value }); setGroupDirty(true); }} className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600" placeholder="用途说明（可选）"/><label className="mt-2 inline-flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={permissionGroups.find(g => g.id === selectedPermissionGroup)?.enabled !== false} onChange={e => { setPermissionGroups(previous => previous.map(g => g.id === selectedPermissionGroup ? { ...g, enabled: e.target.checked } : g)); setGroupDirty(true); }} />群组启用</label></div><div className="flex items-center gap-2"><button type="button" onClick={deletePermissionGroup} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50">删除群组</button></div></div>
                        <div className="mt-4"><div className="mb-2 flex flex-wrap items-center justify-between gap-2"><h4 className="text-sm font-semibold text-slate-800">授权成员</h4><div className="flex flex-wrap items-center gap-2"><input value={groupMemberSearch} onChange={e => setGroupMemberSearch(e.target.value)} className="w-44 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs" placeholder="搜索用户名"/><button type="button" onClick={() => toggleVisibleGroupMembers(true)} className="rounded border border-cyan-200 px-2 py-1 text-[11px] text-cyan-700 hover:bg-cyan-50">全选筛选结果</button><button type="button" onClick={() => toggleVisibleGroupMembers(false)} className="rounded border border-slate-200 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-50">移除筛选结果</button></div></div><div className="flex max-h-44 flex-wrap gap-2 overflow-y-auto">{users.filter(user => user.username.toLowerCase().includes(groupMemberSearch.trim().toLowerCase())).map(user => <label key={user.id} className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-xs ${((permissionGroups.find(g => g.id === selectedPermissionGroup)?.userIds || []) as number[]).includes(user.id) ? 'border-cyan-300 bg-cyan-50 text-cyan-800' : 'border-slate-200 bg-slate-50 text-slate-600'}`}><input type="checkbox" className="h-3.5 w-3.5 rounded border-slate-300 text-cyan-700" checked={((permissionGroups.find(g => g.id === selectedPermissionGroup)?.userIds || []) as number[]).includes(user.id)} onChange={() => toggleGroupMember(user.id)}/>{user.username}</label>)}</div></div>
                        <div className="mt-5"><h4 className="mb-2 text-sm font-semibold text-slate-800">群组权限</h4><div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{visiblePermissionEntries.map(([key, label]) => { const checked = ((permissionGroups.find(g => g.id === selectedPermissionGroup)?.permissions || []) as string[]).includes(key); return <label key={key} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs ${checked ? 'border-cyan-200 bg-cyan-50 text-cyan-800' : 'border-slate-200 text-slate-600'}`}><input type="checkbox" className="h-3.5 w-3.5 rounded border-slate-300 text-cyan-700" checked={checked} onChange={() => toggleGroupPermission(key as Permission)}/><span>{label}</span></label>; })}</div></div>
                        <p className="mt-4 text-[11px] text-slate-500">群组权限与个人授权可叠加；保存后成员下一次请求即可生效，现有角色和个人权限不会丢失。个人矩阵展示有效权限，群组权限不能被个人矩阵撤销。</p>
                        <div className="sticky bottom-0 mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-cyan-200 bg-cyan-50 px-4 py-3"><span className="text-xs text-cyan-800">{groupDirty ? '有未保存的群组变更' : '当前群组设置已保存'}<span className="ml-2 text-cyan-600">可保存名称、启停状态、成员和权限</span></span><button type="button" disabled={!groupDirty} onClick={savePermissionGroup} className="rounded-lg bg-cyan-700 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-cyan-800 disabled:cursor-not-allowed disabled:bg-slate-300">保存群组设置</button></div>
                      </>}
                    </section>
                  </div>
                ) : (
                <>
                <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <select value={permissionDomain} onChange={e => setPermissionDomain(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700" aria-label="权限业务域">
                    {Object.entries(PERMISSION_DOMAIN_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                  </select>
                  <input value={permissionSearch} onChange={e => setPermissionSearch(e.target.value)} className="w-56 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs" placeholder="搜索权限名称或编码" />
                  <label className="inline-flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={authorizedOnly} onChange={e => setAuthorizedOnly(e.target.checked)} className="rounded border-slate-300 text-cyan-700" />只显示已有授权</label>
                  <span className="ml-auto text-[11px] text-slate-500">当前显示 {visiblePermissionEntries.length} 项权限</span>
                </div>
                <div
                  ref={permissionMatrixRef}
                  onPointerDown={startPermissionDrag}
                  onPointerMove={movePermissionDrag}
                  onPointerUp={stopPermissionDrag}
                  onPointerCancel={stopPermissionDrag}
                  onWheel={wheelPermissionMatrix}
                  onScroll={updatePermissionScroll}
                  onDragStart={event => event.preventDefault()}
                  className={`select-none overflow-x-auto rounded-lg border border-gray-200 scroll-smooth ${permissionDragging ? 'cursor-grabbing ring-2 ring-cyan-300' : 'cursor-grab'}`}
                  style={{ scrollbarGutter: 'stable', touchAction: 'pan-y' }}
                >
                  <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 bg-white px-3 py-2 text-[11px] text-slate-500"><span>勾选框 = 个人直授权限（可编辑）</span><span><i className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-violet-500" />紫点 = 角色/群组继承（只读）</span></div>
                  <table
                    className="divide-y divide-gray-200"
                    style={{ minWidth: '2200px' }}
                  >
                     <thead className="bg-gray-50">
                       <tr>
                         <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-32 sticky left-0 bg-gray-50 z-10">用户</th>
                         {/* Render all permission headers */}
                         {visiblePermissionEntries.map(([key, label]) => (
                           <th key={key} className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase whitespace-nowrap min-w-[100px]">{label}</th>
                         ))}
                         <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">状态</th>
                       </tr>
                     </thead>
                     <tbody className="bg-white divide-y divide-gray-200">
                       {users.map(u => (
                         <tr key={u.id} className="hover:bg-gray-50">
                           <td className="px-4 py-4 text-sm font-medium text-gray-900 sticky left-0 bg-white hover:bg-gray-50 z-10 border-r border-gray-100 shadow-sm">
                             {u.username}
                             <div className="text-xs text-gray-400 font-normal">{ROLE_LABELS[u.role] || u.role}</div>
                             <div className="mt-1 flex flex-wrap gap-1"><span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">角色继承</span><span className="rounded-full bg-cyan-50 px-1.5 py-0.5 text-[10px] font-medium text-cyan-700">个人授权</span>{(u.permissionGroupIds || []).map(groupId => { const group = permissionGroups.find(item => item.id === groupId); return <span key={groupId} className="rounded-full bg-violet-50 px-1.5 py-0.5 text-[10px] font-medium text-violet-700">群组：{group?.name || `#${groupId}`}</span>; })}</div>
                             {!USE_MOCK_DATA && tenants.length>0 && <div className="mt-1 flex flex-wrap gap-1">{tenants.map(t=><button key={t.id} onClick={()=>bindTenant(u.id,t.id)} className="rounded bg-cyan-50 px-1.5 py-0.5 text-[10px] text-cyan-700">绑定 {t.tenantCode}</button>)}</div>}
                           </td>
                           
                           {/* Permission Checkboxes */}
                           {visiblePermissionEntries.map(([permKey]) => (
                             <td key={permKey} className="px-2 py-4 text-center">
                               <input 
                                 type="checkbox"
                                 className={`h-4 w-4 ${themeConfig.classes.text} focus:ring-blue-500 border-gray-300 rounded cursor-pointer`}
                                 checked={(u.personalPermissions || []).includes(permKey as Permission)}
                                 title={u.permissions.includes(permKey as Permission) && !(u.personalPermissions || []).includes(permKey as Permission)
                                   ? `继承权限：${(u.permissionSources?.[permKey] || []).join('、')}`
                                   : '个人直授权限：可编辑'}
                                 onChange={() => togglePermission(u.id, permKey as Permission)}
                               />
                               {u.permissions.includes(permKey as Permission) && !(u.personalPermissions || []).includes(permKey as Permission) && <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-violet-500 align-middle" aria-label="继承权限" />}
                             </td>
                           ))}

                           <td className="px-4 py-4 text-center text-sm">
                              <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${u.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                {u.status === 'active' ? '正常' : '禁用'}
                              </span>
                              {permissionDirty.has(u.id) && <button onClick={() => saveUserPermissions(u.id)} className="mt-2 rounded bg-cyan-700 px-3 py-1 text-xs font-semibold text-white hover:bg-cyan-800">保存权限设置</button>}
                              {!USE_MOCK_DATA && <div className="mt-2 flex flex-wrap justify-center gap-2"><button onClick={()=>openPermissionDetail(u)} className="text-xs text-cyan-700">权限详情</button><button onClick={()=>simulateUserPermissions(u)} className="text-xs text-violet-700">模拟权限</button><button onClick={() => deleteRemoteUser(u)} className="text-xs text-red-600">删除</button><button onClick={() => {setAdminError('');setCredentialForm({username:u.username,password:'',role:String(u.role)});setUserDialog({mode:'edit',user:u});}} className="text-xs text-orange-600">修改</button></div>}
                           </td>
                         </tr>
                       ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-3 flex items-center justify-end gap-3 text-xs text-slate-600"><button disabled={userPage===0} onClick={()=>setUserPage(p=>p-1)} className="rounded border px-3 py-1 disabled:opacity-40">上一页</button><span>{userPage+1}/{Math.max(userTotalPages,1)}</span><button disabled={userPage+1>=userTotalPages} onClick={()=>setUserPage(p=>p+1)} className="rounded border px-3 py-1 disabled:opacity-40">下一页</button></div>
                </>
                )}
                {!USE_MOCK_DATA && <div className="mt-8">
                  <h3 className="text-lg font-medium text-gray-900 mb-3">设备会话管理</h3>
                  <div className="overflow-x-auto border border-gray-200 rounded-lg">
                    <table className="min-w-full text-sm"><thead className="bg-gray-50"><tr><th className="p-3 text-left">用户</th><th className="p-3 text-left">设备</th><th className="p-3 text-left">IP</th><th className="p-3 text-left">创建/到期</th><th className="p-3 text-left">状态</th><th className="p-3">操作</th></tr></thead>
                    <tbody>{sessions.map(s=><tr key={s.id} className="border-t"><td className="p-3">{s.username}</td><td className="p-3 max-w-xs truncate" title={s.userAgent}>{s.userAgent||'未知设备'}</td><td className="p-3 font-mono">{s.ipAddress||'-'}</td><td className="p-3 text-xs">{new Date(s.createdAt).toLocaleString()}<br/>{new Date(s.expiresAt).toLocaleString()}</td><td className="p-3">{s.revoked?<span className="text-gray-400">已撤销</span>:<span className="text-green-600">有效</span>}</td><td className="p-3 text-center space-x-2">{!s.revoked&&<button onClick={()=>revokeSession(s.id)} className="text-red-600">撤销</button>}<button onClick={()=>revokeUserSessions(s.username)} className="text-orange-600">撤销该用户全部</button></td></tr>)}</tbody></table>
                  </div>
                  <div className="mt-3 flex items-center justify-end gap-3 text-xs text-slate-600"><button disabled={sessionPage===0} onClick={()=>setSessionPage(p=>p-1)} className="rounded border px-3 py-1 disabled:opacity-40">上一页</button><span>{sessionPage+1}/{Math.max(sessionTotalPages,1)}</span><button disabled={sessionPage+1>=sessionTotalPages} onClick={()=>setSessionPage(p=>p+1)} className="rounded border px-3 py-1 disabled:opacity-40">下一页</button></div>
                </div>}
                {!USE_MOCK_DATA && <div className="mt-8 rounded-xl border border-cyan-200 bg-cyan-50 p-5">
                  <h3 className="text-lg font-medium text-slate-900">客户租户与资产归属</h3>
                  <div className="mt-3 grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                    <input value={tenantForm.tenantCode} onChange={e=>setTenantForm({...tenantForm,tenantCode:e.target.value})} placeholder="租户编码" className="rounded-lg border border-slate-300 px-3 py-2 text-sm"/>
                    <input value={tenantForm.tenantName} onChange={e=>setTenantForm({...tenantForm,tenantName:e.target.value})} placeholder="租户名称" className="rounded-lg border border-slate-300 px-3 py-2 text-sm"/>
                    <button onClick={createTenant} className="rounded-lg bg-cyan-700 px-4 py-2 text-sm font-semibold text-white">创建租户</button>
                  </div>
                  <div className="mt-4 flex gap-2"><input value={tenantAsset} onChange={e=>setTenantAsset(e.target.value)} placeholder="历史资产 SN" className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"/>{tenants.map(t=><button key={t.id} onClick={()=>migrateAsset(t.id)} disabled={!tenantAsset} className="rounded-lg border border-cyan-700 px-3 py-2 text-xs text-cyan-800">迁移至 {t.tenantName}</button>)}</div>
                  <div className="mt-4 flex flex-wrap gap-2">{tenants.map(t=><span key={t.id} className="rounded-full bg-white px-3 py-1 text-xs text-slate-700">{t.tenantCode} · {t.tenantName}</span>)}</div>
                  <div className="mt-3 flex items-center justify-end gap-3 text-xs text-slate-600"><button disabled={tenantPage===0} onClick={()=>setTenantPage(p=>p-1)} className="rounded border px-3 py-1 disabled:opacity-40">上一页</button><span>{tenantPage+1}/{Math.max(tenantTotalPages,1)}</span><button disabled={tenantPage+1>=tenantTotalPages} onClick={()=>setTenantPage(p=>p+1)} className="rounded border px-3 py-1 disabled:opacity-40">下一页</button></div>
                </div>}
              </div>
            )}

            {/* --- TAB: GENERAL --- */}
            {activeTab === 'general' && (
               <div className="space-y-6 animate-in fade-in">
                  
                  {/* Theme Selector */}
                  <div className="bg-white border border-gray-200 p-6 rounded-md shadow-sm">
                    <h4 className="text-sm font-bold text-gray-800 flex items-center mb-4">
                      <Palette className="w-4 h-4 mr-2"/> 系统主题外观 (Theme)
                    </h4>
                    <div className="flex gap-4">
                       {(Object.keys(THEMES) as ThemeColor[]).map((t) => (
                         <button
                         key={t}
                           onClick={() => { setSystemSettings(previous => ({ ...previous, theme: t })); setTheme(t); }}
                           style={systemSettings.theme === t ? { borderColor: 'var(--theme-primary)', backgroundColor: 'var(--theme-primary-soft)' } : undefined}
                           className={`flex flex-col items-center gap-2 rounded-lg border-2 p-2 transition-all ${systemSettings.theme === t ? '' : 'border-transparent hover:bg-gray-50'}`}
                         >
                            <div className={`w-8 h-8 rounded-full ${THEMES[t].classes.bg} shadow-sm ring-2 ring-white`}></div>
                            <span className={`text-xs font-medium ${systemSettings.theme === t ? 'text-gray-900' : 'text-gray-500'}`}>{THEMES[t].name}</span>
                         </button>
                       ))}
                    </div>
                    <div className="theme-accent-soft mt-5 flex items-center gap-3 rounded-lg border px-4 py-3 text-sm">
                      <span className="theme-accent-bg h-3 w-3 rounded-full shadow-sm" />
                      <span>当前预览：<b>{THEMES[systemSettings.theme as ThemeColor]?.name || '系统主题'}</b></span>
                      <span className="ml-auto text-xs opacity-75">保存后同步到所有账号</span>
                    </div>
                  </div>

                  <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-md">
                    <h4 className="text-sm font-bold text-yellow-800 flex items-center">
                      <AlertCircle className="w-4 h-4 mr-2"/> 维护模式
                    </h4>
                    <p className="text-xs text-yellow-700 mt-1">启用维护模式后，除管理员外，其他用户将无法登录系统。</p>
                    <div className="mt-3">
                      <label className="flex items-center space-x-3">
                        <input type="checkbox" checked={systemSettings.maintenanceMode} onChange={e=>setSystemSettings(previous=>({...previous,maintenanceMode:e.target.checked}))} className="h-4 w-4 text-yellow-600 border-gray-300 rounded"/>
                        <span className="text-sm font-medium text-gray-700">启用系统维护模式</span>
                      </label>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">系统名称</label>
                      <input type="text" value={systemSettings.appName} onChange={e=>setSystemSettings(previous=>({...previous,appName:e.target.value}))} className="mt-1 block w-full border border-gray-300 rounded p-2 text-sm"/>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">日志保留天数</label>
                      <input type="number" value={systemSettings.logRetentionDays} onChange={e=>setSystemSettings(previous=>({...previous,logRetentionDays:Number(e.target.value)}))} className="mt-1 block w-full border border-gray-300 rounded p-2 text-sm"/>
                    </div>
                  </div>
                  
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                    <div className="flex items-center justify-between gap-4"><div><h4 className="font-semibold text-slate-900">公司 Logo</h4><p className="mt-1 text-xs text-slate-500">建议 128-2048px 宽、32-1024px 高，PNG/JPG/GIF/WebP，最大 2MB；SVG 为安全原因不支持。</p></div><input ref={logoInputRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp" className="hidden" onChange={handleLogoImport}/><button onClick={()=>logoInputRef.current?.click()} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">选择并保存 Logo</button></div>
                    {logoValue && <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3"><img src={logoValue} alt="当前公司 Logo" className="h-14 max-w-[240px] object-contain"/></div>}
                  </div>
                  <div className="pt-4 border-t border-gray-200"><button onClick={saveSystemSettings} className="slss-btn-primary px-5 py-2 text-sm shadow-sm"><Save className="mr-2 inline h-4 w-4"/>保存基础设置</button><span className="ml-3 text-xs text-slate-500">主题、系统名称、维护模式和日志保留天数将同步到所有账号。</span></div>
               </div>
            )}

          </div>
        </div>
      </div>
      {permissionDiff && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4" role="dialog" aria-modal="true" aria-labelledby="permission-diff-title">
        <div className="w-full max-w-lg overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-start justify-between bg-cyan-800 px-6 py-5 text-white"><div><p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200">Permission Diff</p><h3 id="permission-diff-title" className="mt-1 text-lg font-semibold">权限变更预览 · {permissionDiff.username}</h3></div><button onClick={() => setPermissionDiff(null)} className="rounded-md p-1 text-cyan-100 hover:bg-white/10" aria-label="关闭"><X className="h-5 w-5"/></button></div>
          <div className="grid gap-4 p-6 sm:grid-cols-2"><div><h4 className="mb-2 text-sm font-semibold text-emerald-700">新增个人直授（{permissionDiff.added.length}）</h4>{permissionDiff.added.length ? <ul className="space-y-1 text-xs text-slate-700">{permissionDiff.added.map(key => <li key={key} className="rounded bg-emerald-50 px-2 py-1">{PERMISSION_LABELS[key as Permission] || key}</li>)}</ul> : <p className="text-xs text-slate-400">无</p>}</div><div><h4 className="mb-2 text-sm font-semibold text-rose-700">移除个人直授（{permissionDiff.removed.length}）</h4>{permissionDiff.removed.length ? <ul className="space-y-1 text-xs text-slate-700">{permissionDiff.removed.map(key => <li key={key} className="rounded bg-rose-50 px-2 py-1">{PERMISSION_LABELS[key as Permission] || key}</li>)}</ul> : <p className="text-xs text-slate-400">无</p>}</div></div>
          <div className="border-t border-slate-200 bg-slate-50 px-6 py-4 text-right"><button onClick={() => setPermissionDiff(null)} className="rounded-lg bg-cyan-700 px-4 py-2 text-sm font-semibold text-white">知道了</button></div>
        </div>
      </div>}
      {permissionDetail && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4" role="dialog" aria-modal="true" aria-labelledby="permission-detail-title"><div className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl"><div className="flex items-start justify-between bg-slate-900 px-6 py-5 text-white"><div><p className="text-xs uppercase tracking-[0.22em] text-cyan-300">Permission Detail</p><h3 id="permission-detail-title" className="mt-1 text-lg font-semibold">{permissionDetail.username} 的权限详情</h3></div><button onClick={()=>setPermissionDetail(null)} className="rounded p-1 text-slate-300 hover:bg-white/10"><X className="h-5 w-5"/></button></div><div className="grid gap-5 p-6 md:grid-cols-2"><div><h4 className="mb-2 text-sm font-semibold text-slate-800">有效权限（{permissionDetail.effectivePermissions?.length || 0}）</h4><div className="flex flex-wrap gap-1.5">{(permissionDetail.effectivePermissions||[]).map((key:string)=><span key={key} className="rounded-full bg-cyan-50 px-2 py-1 text-[11px] text-cyan-800">{PERMISSION_LABELS[key as Permission]||key}</span>)}</div></div><div><h4 className="mb-2 text-sm font-semibold text-rose-700">显式拒绝（{permissionDetail.deniedPermissions?.length || 0}）</h4><div className="flex flex-wrap gap-1.5">{(permissionDetail.deniedPermissions||[]).map((key:string)=><span key={key} className="rounded-full bg-rose-50 px-2 py-1 text-[11px] text-rose-800">{PERMISSION_LABELS[key as Permission]||key}</span>)}</div><div className="mt-3 flex gap-2"><select value={denyCandidate} onChange={e=>setDenyCandidate(e.target.value)} className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1 text-xs"><option value="">选择要拒绝的权限</option>{Object.entries(PERMISSION_LABELS).filter(([key])=>!(permissionDetail.deniedPermissions||[]).includes(key)).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select><button disabled={!denyCandidate} onClick={async()=>{try{await api.createPermissionApproval({targetType:'USER',targetId:permissionDetail.userId,changeType:'OVERRIDE',payloadJson:JSON.stringify({permissionCode:denyCandidate,effect:'DENY'})});setSaveStatus({type:'success',message:'DENY 权限变更已提交审批'});setDenyCandidate('');setPermissionApprovals(await api.permissionApprovals());}catch(e:any){setAdminError(e.message);}}} className="rounded bg-rose-600 px-2 py-1 text-xs text-white disabled:opacity-40">提交 DENY 审批</button></div></div><div className="md:col-span-2"><h4 className="mb-2 text-sm font-semibold text-slate-800">权限来源</h4><div className="grid gap-2 sm:grid-cols-2">{Object.entries(permissionDetail.sources||{}).map(([key,value])=><div key={key} className="rounded-lg border border-slate-200 p-2 text-xs"><div className="font-semibold text-slate-700">{PERMISSION_LABELS[key as Permission]||key}</div><div className="mt-1 text-slate-500">{(value as string[]).join('、')}</div></div>)}</div></div><div className="md:col-span-2"><h4 className="mb-2 text-sm font-semibold text-slate-800">数据范围</h4><div className="flex flex-wrap gap-2">{Object.entries(permissionDetail.scopes||{}).map(([key,value])=><span key={key} className="rounded bg-violet-50 px-2 py-1 text-xs text-violet-800">{PERMISSION_LABELS[key as Permission]||key}：{String(value)}</span>)}{!Object.keys(permissionDetail.scopes||{}).length&&<span className="text-xs text-slate-400">未配置，默认按现有业务范围执行</span>}</div></div></div><div className="border-t border-slate-200 bg-slate-50 px-6 py-4 text-right"><button onClick={()=>setPermissionDetail(null)} className="rounded-lg bg-cyan-700 px-4 py-2 text-sm font-semibold text-white">关闭</button></div></div></div>}
      {permissionSimulation && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4" role="dialog" aria-modal="true" aria-labelledby="permission-simulation-title"><div className="w-full max-w-xl rounded-xl border border-slate-200 bg-white shadow-2xl"><div className="flex items-start justify-between bg-violet-800 px-6 py-5 text-white"><div><p className="text-xs uppercase tracking-[0.22em] text-violet-200">Permission Simulation</p><h3 id="permission-simulation-title" className="mt-1 text-lg font-semibold">模拟 {permissionSimulation.username} 的最终权限</h3></div><button onClick={()=>setPermissionSimulation(null)} className="rounded p-1 text-violet-100 hover:bg-white/10"><X className="h-5 w-5"/></button></div><div className="p-6"><p className="mb-3 text-xs text-slate-500">此视图只读，用于验证用户当前能访问的功能、拒绝项和数据范围。</p><div className="flex flex-wrap gap-2">{(permissionSimulation.effectivePermissions||[]).map((key:string)=><span key={key} className="rounded-full bg-violet-50 px-2.5 py-1 text-xs text-violet-800">{PERMISSION_LABELS[key as Permission]||key}</span>)}</div></div><div className="border-t border-slate-200 bg-slate-50 px-6 py-4 text-right"><button onClick={()=>setPermissionSimulation(null)} className="rounded-lg bg-violet-700 px-4 py-2 text-sm font-semibold text-white">关闭模拟</button></div></div></div>}
      {groupCreateDialog && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="group-dialog-title">
        <div className="w-full max-w-md overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-start justify-between bg-cyan-800 px-6 py-5 text-white"><div><p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200">Permission Group</p><h3 id="group-dialog-title" className="mt-1 text-lg font-semibold">新建权限组</h3></div><button onClick={()=>setGroupCreateDialog(false)} className="rounded-md p-1 text-cyan-100 hover:bg-white/10" aria-label="关闭"><X className="h-5 w-5"/></button></div>
          <div className="space-y-4 p-6"><label className="block"><span className="text-sm font-medium text-slate-700">权限组名称</span><input autoFocus value={groupForm.name} onChange={e=>setGroupForm({...groupForm,name:e.target.value})} placeholder="例如：生产操作员" className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"/></label><label className="block"><span className="text-sm font-medium text-slate-700">用途说明（可选）</span><textarea value={groupForm.description} onChange={e=>setGroupForm({...groupForm,description:e.target.value})} rows={3} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"/></label></div>
          <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4"><button onClick={()=>setGroupCreateDialog(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-white">取消</button><button onClick={createPermissionGroup} className="rounded-lg bg-cyan-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-cyan-800">创建权限组</button></div>
        </div>
      </div>}
      {userDialog && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="user-dialog-title">
        <div className="w-full max-w-md overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-start justify-between bg-slate-900 px-6 py-5 text-white">
            <div><p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">Access Control</p><h3 id="user-dialog-title" className="mt-1 text-lg font-semibold">{userDialog.mode==='create'?'创建系统用户':'修改用户信息'}</h3></div>
            <button onClick={()=>setUserDialog(null)} className="rounded-md p-1 text-slate-300 hover:bg-white/10 hover:text-white" aria-label="关闭"><X className="h-5 w-5"/></button>
          </div>
          <div className="space-y-4 p-6">
            {adminError&&<p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{adminError}</p>}
            <label className="block"><span className="text-sm font-medium text-slate-700">用户名/员工工号</span><input autoFocus={userDialog.mode==='create'} maxLength={100} placeholder="至少 3 个字符" value={credentialForm.username} onChange={e=>setCredentialForm({...credentialForm,username:e.target.value})} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"/><span className="mt-1 block text-xs text-slate-500">至少 3 个字符，数字、字母或组合均可。</span></label>
            <label className="block"><span className="text-sm font-medium text-slate-700">角色</span><select value={credentialForm.role} onChange={e=>setCredentialForm({...credentialForm,role:e.target.value})} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5"><option value="TECHNICIAN">技术人员</option><option value="PRODUCTION">生产人员</option><option value="ADMIN">管理员</option></select></label>
            <label className="block"><span className="text-sm font-medium text-slate-700">{userDialog.mode==='create'?'初始密码':'新密码（留空则不修改）'}</span><input type="password" autoFocus value={credentialForm.password} onChange={e=>setCredentialForm({...credentialForm,password:e.target.value})} minLength={8} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"/><span className="mt-1 block text-xs text-slate-500">填写密码即可修改/重置密码。</span></label>
          </div>
          <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4"><button onClick={()=>setUserDialog(null)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-white">取消</button><button onClick={()=>userDialog.mode==='create'?createRemoteUser():updateRemoteUser(userDialog.user!)} className="rounded-lg bg-cyan-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-cyan-800">{userDialog.mode==='create'?'创建用户':'保存修改'}</button></div>
        </div>
      </div>}
    </div>
  );
};

export default AdminPanel;
