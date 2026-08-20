import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ClipboardList, Database, ScanLine, Settings2, CheckCircle2, AlertTriangle, Trash2, Wrench, Download } from 'lucide-react';
import ProductionImport, { ProductionEntryTemplate } from './ProductionImport';
import ProductionList from './ProductionList';
import ProductionScanTemplates from './ProductionScanTemplates';
import { useAuth } from '../components/AuthContext';
import { api, productionApi } from '../services/apiClient';
import { PageContainer } from '../components/design-system/primitives';

type Field = { key: string; label: string; required: boolean; enabled?: boolean; scanRequired?: boolean; requireModel?: boolean; fieldType?: string; section?: '组装' | '高温间测试' | '包装' };
type Template = { id: string; name: string; model?: string; description?: string; symbology?: string; active: boolean; fields: Field[] };
type ScanTableRecord = { id: string; name: string; model: string; status?: string; dispatchOrderNo?: string; disableAutoFillPartModels?: boolean; createdAt: string; quantity: number; template: ProductionEntryTemplate; rows?: any[] };

const readScanTables = (): ScanTableRecord[] => {
  return [];
};

const normalizeScanTable = (item: any): ScanTableRecord => {
  const baseFields = [...(item?.template?.fields || [])].sort((a:any,b:any) => Number(a.sortOrder ?? a.sort_order ?? 0) - Number(b.sortOrder ?? b.sort_order ?? 0)).map((f: any) => ({
    fieldKey: f.fieldKey || f.field_key,
    fieldLabel: f.fieldLabel || f.field_label,
    required: f.required ?? false,
    section: f.section || '组装',
    sortOrder: Number(f.sortOrder ?? f.sort_order ?? 0),
  }));
  const knownKeys = new Set(baseFields.map((f: any) => f.fieldKey));
  (item?.rows || []).flatMap((row: any) => row.values || []).forEach((value: any) => {
    const key = value.fieldKey || value.field_key;
    if (!key || knownKeys.has(key)) return;
    knownKeys.add(key);
    const label = /内存|mem/i.test(key) ? '内存 SN' : /sn|序列号/i.test(key) ? key.replace(/^extra_/, '') : key;
    baseFields.push({ fieldKey: key, fieldLabel: label, required: false, section: '组装', sortOrder: baseFields.length });
  });
  return {
    id: String(item?.id),
    name: item?.customerName || item?.customer_name || '',
    model: item?.model || '',
    dispatchOrderNo: item?.dispatchOrderNo || item?.dispatch_order_no || '',
    disableAutoFillPartModels: item?.disableAutoFillPartModels ?? item?.disable_auto_fill_part_models ?? false,
    createdAt: item?.createdAt || item?.created_at || new Date().toISOString(),
    quantity: item?.quantity || 0,
    rows: item?.rows || [],
    template: { id: String(item?.template?.id || ''), name: item?.customerName || '', model: item?.model || '', fields: baseFields.map((f: any) => ({ key: f.fieldKey, label: f.fieldLabel, required: f.required, section: f.section, sortOrder: f.sortOrder })) },
  };
};

export default function ProductionMES() {
  const { user } = useAuth();
  const normalizePermissions = (permissions: string[] = []) => permissions.map(permission => permission.replace(/^PERM_/, ''));
  const [sessionPermissions, setSessionPermissions] = useState<string[]>(normalizePermissions((user?.permissions || []) as string[]));
  useEffect(() => {
    // Keep module visibility in sync when AuthContext refreshes the session
    // after permission changes; the initial state is not sufficient because
    // it is created before the async refresh response arrives.
    setSessionPermissions(normalizePermissions((user?.permissions || []) as string[]));
  }, [user?.permissions]);
  useEffect(() => {
    api.currentSession().then(result => {
      const permissions = normalizePermissions(result.authorities);
      setSessionPermissions(permissions);
      const synchronizedUser = { ...(user || {}), username: result.username, permissions, mustChangePassword: false };
      localStorage.setItem('slss_user', JSON.stringify(synchronizedUser));
      window.dispatchEvent(new CustomEvent('slss-session-updated', { detail: synchronizedUser }));
    }).catch(() => undefined);
  }, []);
  useEffect(() => {
    const sync = (event: any) => setSessionPermissions(normalizePermissions(event.detail?.permissions || []));
    window.addEventListener('slss-session-updated', sync);
    return () => window.removeEventListener('slss-session-updated', sync);
  }, []);
  const hasPermission = (code: string) => sessionPermissions.includes(code) || sessionPermissions.includes(`PERM_${code}`);
  // Creating a scan table is an explicit permission; viewing/managing other
  // production data must not implicitly expose this entry.
  const canUseTemplate = hasPermission('CREATE_SCAN_TABLE');
  const canDeleteScanTable = hasPermission('DELETE_SCAN_TABLE');
  const canManageTemplates = hasPermission('MANAGE_SCAN_TEMPLATE');
  const canForceEditCompleted = hasPermission('FORCE_EDIT_COMPLETED_SCAN');
  // Force-edit operators are allowed to remove rows they are allowed to
  // add; the dedicated delete permission remains supported for finer RBAC.
  const canDeleteProductionColumn = hasPermission('DELETE_PRODUCTION_COLUMN') || hasPermission('FORCE_EDIT_COMPLETED_SCAN') || hasPermission('MANAGE_PRODUCTION');
  // Permissions may arrive from login/refresh as either the persisted code
  // (MANAGE_PRODUCTION_REPAIR) or Spring authority (PERM_...). Always use the
  // normalized helper so employee accounts receive the same module access.
  const canManageRepair = hasPermission('MANAGE_PRODUCTION_REPAIR') || hasPermission('MANAGE_PRODUCTION') || hasPermission('FORCE_EDIT_COMPLETED_SCAN');
  const [tab, setTab] = useState<'entry' | 'tables' | 'repair' | 'query' | 'templates'>('tables');
  useEffect(() => {
    if (!canUseTemplate && tab === 'entry') setTab('tables');
    if (!canManageRepair && tab === 'repair') setTab('tables');
  }, [canUseTemplate, canManageRepair, tab]);
  const [templates, setTemplates] = useState<Template[]>([]);
  useEffect(() => {
    productionApi.scanTemplates().then((items:any[]) => setTemplates((items || []).map(item => ({
      id: String(item.id),
      name: item.customerName || item.customer_name || '',
      model: item.model || '',
      description: item.description || '',
      symbology: 'CODE_128',
      active: item.active !== false,
      fields: [...(item.fields || [])].sort((a:any,b:any) => Number(a.sortOrder ?? a.sort_order ?? 0) - Number(b.sortOrder ?? b.sort_order ?? 0)).map((field:any) => ({
        key: field.fieldKey || field.field_key || field.key,
        label: field.fieldLabel || field.field_label || field.label,
        required: field.required ?? false,
        enabled: field.enabled !== false,
        scanRequired: field.scanRequired ?? String(field.fieldType || field.type || '').toUpperCase() === 'SN',
        requireModel: field.requireModel === true,
        section: (['组装', '高温间测试', '包装'].includes(field.section) ? field.section : '组装') as '组装' | '高温间测试' | '包装',
        sortOrder: Number(field.sortOrder ?? field.sort_order ?? 0),
        fieldType: field.fieldType || field.field_type || field.type,
      })),
    })))).catch((error:any) => setMessage(error?.message || '加载生产扫码模板失败'));
  }, []);
  const [selectedId, setSelectedId] = useState('');
  const [payload, setPayload] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [dispatchOrderNo, setDispatchOrderNo] = useState('');
  const [disableAutoFillPartModels, setDisableAutoFillPartModels] = useState(false);
  const [confirmedTemplate, setConfirmedTemplate] = useState<ProductionEntryTemplate | null>(null);
  const [confirmedQuantity, setConfirmedQuantity] = useState<number | undefined>();
  const [scanTables, setScanTables] = useState<ScanTableRecord[]>(readScanTables);
  const [selectedScanCustomer, setSelectedScanCustomer] = useState('');
  const [selectedScanTableId, setSelectedScanTableId] = useState('');
  const [selectedScanTableSnapshot, setSelectedScanTableSnapshot] = useState<ScanTableRecord | null>(null);
  const [forceMachineSn, setForceMachineSn] = useState('');
  const [forceAsset, setForceAsset] = useState<any>(null);
  const [forceLoading, setForceLoading] = useState(false);
  const [forceColumnLabel, setForceColumnLabel] = useState('');
  const [forceColumnAfter, setForceColumnAfter] = useState('');
  const [repairMachineSn, setRepairMachineSn] = useState('');
  const [repairAsset, setRepairAsset] = useState<any>(null);
  const [repairHistory, setRepairHistory] = useState<any[]>([]);
  const [repairLoading, setRepairLoading] = useState(false);
  const [querySection, setQuerySection] = useState<'scan' | 'statistics' | 'unfinished' | 'completed'>('scan');
  const [completedTables, setCompletedTables] = useState<any[]>([]);
  const [completedLoading, setCompletedLoading] = useState(false);
  const [completedError, setCompletedError] = useState('');
  const [unfinishedTables, setUnfinishedTables] = useState<any[]>([]);
  const [unfinishedLoading, setUnfinishedLoading] = useState(false);
  const [unfinishedError, setUnfinishedError] = useState('');
  const [statisticsSection, setStatisticsSection] = useState<'production' | 'repair'>('production');
  const [productionStatisticsSn, setProductionStatisticsSn] = useState('');
  const [repairStatisticsSn, setRepairStatisticsSn] = useState('');
  const today = new Date().toISOString().slice(0, 10);
  const [statisticsRange, setStatisticsRange] = useState({ from: `${today.slice(0, 8)}01`, to: today });
  const [productionStatistics, setProductionStatistics] = useState<any>(null);
  const [statisticsBatchDetail, setStatisticsBatchDetail] = useState<any>(null);
  const [selectedStatisticsBatches, setSelectedStatisticsBatches] = useState<string[]>([]);
  const [selectedRepairDevices, setSelectedRepairDevices] = useState<string[]>([]);
  const statisticsBatchKey = (row: any) => String(row.scanTableId || row.batchName || `${row.customerName || ''}/${row.model || ''}`);
  const productionSummaryRows = useMemo(() => {
    if (!productionStatistics) return [];
    const source = [
      ...(productionStatistics.completedDevices || []).map((row:any) => ({ ...row, _state: 'completed' })),
      ...(productionStatistics.unfinishedDevices || []).map((row:any) => ({ ...row, _state: 'unfinished' })),
    ];
    const grouped = new Map<string, any>();
    source.forEach(row => {
      const key = String(row.scanTableId || row.batchName || `${row.customerName || ''}/${row.model || ''}`);
      const current = grouped.get(key) || { ...row, quantity: 0, machineSns: [], _completed: 0, _unfinished: 0 };
      current.quantity += 1;
      if (row.machineSn && !current.machineSns.includes(row.machineSn)) current.machineSns.push(row.machineSn);
      if (row._state === 'completed') current._completed += 1; else current._unfinished += 1;
      grouped.set(key, current);
    });
    return Array.from(grouped.values()).map(row => ({
      ...row,
      state: row._completed > 0 && row._unfinished > 0 ? '部分完工' : row._completed > 0 ? '已完工' : '未完工',
    }));
  }, [productionStatistics]);
  const [statisticsLoading, setStatisticsLoading] = useState(false);
  useEffect(() => {
    if (querySection !== 'completed') return;
    setCompletedLoading(true); setCompletedError('');
    productionApi.completedScanTables()
      .then(items => setCompletedTables(items || []))
      .catch((error: any) => { setCompletedTables([]); setCompletedError(error?.message || '已完工流程单加载失败'); })
      .finally(() => setCompletedLoading(false));
  }, [querySection]);
  useEffect(() => {
    if (querySection !== 'unfinished') return;
    setUnfinishedLoading(true); setUnfinishedError('');
    productionApi.unfinishedScanTables().then(items => setUnfinishedTables(items || [])).catch((error:any) => { setUnfinishedTables([]); setUnfinishedError(error?.message || '未完工流程单加载失败'); }).finally(() => setUnfinishedLoading(false));
  }, [querySection]);
  useEffect(() => {
    const loadTables = () => productionApi.scanTables().then((items:any[]) => setScanTables((items || []).map(item => {
      const baseFields = [...(item.template?.fields || [])].sort((a:any,b:any) => Number(a.sortOrder ?? a.sort_order ?? 0) - Number(b.sortOrder ?? b.sort_order ?? 0)).map((f:any) => ({ fieldKey: f.fieldKey || f.field_key, fieldLabel: f.fieldLabel || f.field_label, required: f.required ?? false, section: f.section || '组装', sortOrder: Number(f.sortOrder ?? f.sort_order ?? 0) }));
      const knownKeys = new Set(baseFields.map((f:any) => f.fieldKey));
      // Older scan tables may have custom columns persisted in row values
      // before their custom-field definition was returned. Keep those columns
      // visible for every account by merging the row keys into the template
      // schema instead of silently rendering only the base memory column.
      (item.rows || []).flatMap((row:any) => row.values || []).forEach((value:any) => {
        const key = value.fieldKey || value.field_key;
        if (!key || knownKeys.has(key)) return;
        knownKeys.add(key);
        const label = /内存|mem/i.test(key) ? '内存 SN' : /sn|序列号/i.test(key) ? key.replace(/^extra_/, '') : key;
        baseFields.push({ fieldKey: key, fieldLabel: label, required: false, section: '组装', sortOrder: baseFields.length });
      });
      return {
      id: String(item.id), name: item.customerName || item.customer_name || '', model: item.model || '', status: String(item.status || '').toUpperCase(), dispatchOrderNo: item.dispatchOrderNo || item.dispatch_order_no || '',
      disableAutoFillPartModels: item.disableAutoFillPartModels ?? item.disable_auto_fill_part_models ?? false,
      createdAt: item.createdAt || item.created_at || new Date().toISOString(), quantity: item.quantity || 0,
      rows: item.rows || [],
      template: { id: String(item.template?.id || ''), name: item.customerName || '', model: item.model || '', active: true, fields: baseFields.map((f:any) => ({ key: f.fieldKey, label: f.fieldLabel, required: f.required, section: f.section, sortOrder: f.sortOrder })) },
      };
    }))).then(() => {
      // The active list intentionally hides completed rows/tables. If another
      // operator changes the current table while this page is open, re-check
      // the selected id by API instead of treating a transient list miss as a
      // deleted table.
      if (selectedScanTableId) {
        productionApi.scanTable(Number(selectedScanTableId)).then(item => {
          if (item) setSelectedScanTableSnapshot(normalizeScanTable(item));
        }).catch(() => {
          setSelectedScanTableSnapshot(null);
          setSelectedScanTableId('');
          setConfirmedTemplate(null);
          setConfirmedQuantity(undefined);
        });
      }
    }).catch((error:any) => setMessage(error?.message || '加载流程单失败'));
    loadTables();
    const timer = window.setInterval(() => {
      // Do not replace the row currently being scanned. Its blur event writes
      // the value first; the next refresh distributes it to every account.
      if (!(document.activeElement instanceof HTMLInputElement) && document.visibilityState === 'visible') loadTables();
    }, 2000);
    return () => window.clearInterval(timer);
  }, [selectedScanTableId]);
  const [statisticsError, setStatisticsError] = useState('');
  const selected = useMemo(() => templates.find(t => t.id === selectedId), [templates, selectedId]);
  // Visibility is authoritative from the backend scan table status. Browser
  // drafts must never hide a table that was not explicitly completed.
  const activeScanTables = scanTables.filter(table => table.status !== 'COMPLETED' && table.status !== 'CANCELLED');
  const scanCustomers = useMemo(
    () => Array.from(new Set(activeScanTables.map(table => table.name?.trim()).filter(Boolean))).sort((left, right) => left.localeCompare(right, 'zh-CN')),
    [activeScanTables],
  );
  const customerScanTables = useMemo(
    () => activeScanTables.filter(table => table.name?.trim() === selectedScanCustomer),
    [activeScanTables, selectedScanCustomer],
  );
  const selectedScanTable = useMemo(
    () => activeScanTables.find(table => table.id === selectedScanTableId) || (selectedScanTableSnapshot?.id === selectedScanTableId ? selectedScanTableSnapshot : undefined),
    [activeScanTables, selectedScanTableId, selectedScanTableSnapshot],
  );
  useEffect(() => {
    if (selectedScanCustomer && !customerScanTables.length) {
      setSelectedScanCustomer('');
      setSelectedScanTableId('');
      setConfirmedTemplate(null);
      setConfirmedQuantity(undefined);
    } else if (selectedScanTableId && !selectedScanTable) {
      setSelectedScanTableId('');
      setConfirmedTemplate(null);
      setConfirmedQuantity(undefined);
    }
  }, [customerScanTables.length, selectedScanCustomer, selectedScanTable, selectedScanTableId]);
  const useTemplate = async () => {
    if (!selected) return;
    const count = Math.min(5000, Math.max(1, Math.floor(Number(quantity) || 0)));
    try {
      const existingTemplates = await productionApi.scanTemplates();
      let template = (existingTemplates || []).find((item:any) =>
        String(item.customerName || item.customer_name || '').trim().toLowerCase() === selected.name.trim().toLowerCase()
        && String(item.model || '').trim().toLowerCase() === String(selected.model || selected.name).trim().toLowerCase()
      );
      if (!template) {
        template = await productionApi.createScanTemplate({ customerName: selected.name, model: selected.model || selected.name, description: selected.description, fields: selected.fields.map(f => ({ key: f.key, label: f.label, type: f.scanRequired ? 'SN' : 'TEXT', required: f.required, enabled: f.enabled !== false, scanRequired: f.scanRequired, requireModel: f.requireModel === true, section: f.section || '组装' })) });
      }
      const table = await productionApi.createScanTable(Number(template.id), count, dispatchOrderNo.trim(), disableAutoFillPartModels);
      const persistedFields = [...(template.fields || [])].sort((a:any,b:any) => Number(a.sortOrder ?? a.sort_order ?? 0) - Number(b.sortOrder ?? b.sort_order ?? 0)).map((field:any) => ({
        key: field.fieldKey || field.field_key || field.key,
        label: field.fieldLabel || field.field_label || field.label,
        required: field.required ?? field.required_flag ?? false,
        enabled: field.enabled !== false,
        scanRequired: field.scanRequired ?? String(field.fieldType || field.type || '').toUpperCase() === 'SN',
        requireModel: field.requireModel === true,
        section: (['组装', '高温间测试', '包装'].includes(field.section) ? field.section : '组装'),
        sortOrder: Number(field.sortOrder ?? field.sort_order ?? 0),
      }));
      const record: ScanTableRecord = { id: String(table.id), name: table.customerName || selected.name, model: table.model || selected.model || selected.name, dispatchOrderNo: table.dispatchOrderNo || dispatchOrderNo.trim(), disableAutoFillPartModels: table.disableAutoFillPartModels ?? disableAutoFillPartModels, createdAt: table.createdAt || new Date().toISOString(), quantity: table.quantity || count, template: { ...selected, id: String(template.id), fields: persistedFields.length ? persistedFields : selected.fields.map(f => ({ ...f })) } };
      setConfirmedTemplate(record.template); setConfirmedQuantity(count); setScanTables(previous => [record, ...previous.filter(item => item.id !== record.id)]);
      setMessage('流程单创建成功，数据已保存到 MySQL，其他账号可直接查看。');
    } catch (error:any) { setMessage(error?.message || '流程单创建失败'); }
  };
  const deleteScanTable = async (table: ScanTableRecord) => {
    if (!canDeleteScanTable) return;
    if (!window.confirm(`确认删除 ${table.name} / ${table.model} 的流程单吗？删除后无法恢复。`)) return;
    try { await productionApi.deleteScanTable(Number(table.id)); } catch (error:any) { setMessage(error?.message || '删除流程单失败'); return; }
    setScanTables(previous => previous.filter(item => item.id !== table.id));
    if (selectedScanTableId === table.id) {
      setSelectedScanTableId('');
      setConfirmedTemplate(null);
      setConfirmedQuantity(undefined);
    }
    setMessage(`已删除 ${table.model} 流程单`);
  };

  const refreshTemplates = async () => {
    try {
      const items = await productionApi.scanTemplates();
      setTemplates((items || []).map((item:any) => ({
        id: String(item.id),
        name: item.customerName || item.customer_name || '',
        model: item.model || '',
        description: item.description || '',
        symbology: 'CODE_128',
        active: item.active !== false,
        fields: [...(item.fields || [])].sort((a:any,b:any) => Number(a.sortOrder ?? a.sort_order ?? 0) - Number(b.sortOrder ?? b.sort_order ?? 0)).map((field:any) => ({
          key: field.fieldKey || field.field_key || field.key,
          label: field.fieldLabel || field.field_label || field.label,
          required: field.required ?? false,
          enabled: field.enabled !== false,
          scanRequired: field.scanRequired ?? String(field.fieldType || field.type || '').toUpperCase() === 'SN',
        })),
      })));
    } catch (error:any) {
      setMessage(error?.message || '刷新生产扫码模板失败');
    }
  };
  const loadForceAsset = async () => {
    if (!canForceEditCompleted || !forceMachineSn.trim()) return;
    setForceLoading(true); setMessage('');
    try {
      const entered = forceMachineSn.trim();
      let asset: any;
      try {
        // Force-edit must use the custom-field projection.  The ordinary
        // asset DTO intentionally omits blank custom rows, which made a row
        // disappear after refresh even though its definition was persisted.
        asset = await productionApi.forceLookup(entered);
      } catch {
        // MES rows are authoritative for completed flow sheets and may not
        // have an Asset projection yet; forceLookup already covers that path.
        asset = await productionApi.getAsset(entered);
      }
      if (!asset || !(asset.machine_sn || asset.machineSn)) {
        throw new Error('未找到该整机的完工扫码数据');
      }
      setForceMachineSn(asset.machine_sn || asset.machineSn || entered);
      setForceAsset(asset);
    } catch (error:any) {
      setForceAsset(null); setMessage(error?.message || '未找到该整机的完工扫码数据');
    } finally { setForceLoading(false); }
  };
  const saveForceAsset = async () => {
    if (!forceAsset) return;
    setForceLoading(true);
    try {
      const components = (forceAsset.components || []).map((component:any) => ({
        ...component,
        fieldKey: component.fieldKey ?? component.field_key ?? '',
        type: component.type ?? '',
        model: component.model ?? '',
        serialNo: component.serialNo ?? component.serial_no ?? '',
      }));
      // Persist through the force-edit endpoint first. It reconciles newly
      // added field definitions and values atomically. Calling saveScanRow
      // before that would make the request fail validation because a freshly
      // added custom field is not yet part of the server definition list.
      const customValues = components
        .filter((component:any) => String(component.fieldKey || '').startsWith('force_'))
        .map((component:any) => ({ fieldKey: component.fieldKey, value: component.serialNo || '' }));
      let saved;
      try {
        saved = await productionApi.forceUpdateCompletedAsset(forceAsset.machine_sn, components);
      } catch (error:any) {
        // A historical scan-only row may not have a machine SN/Asset
        // projection. Reload the authoritative scan projection instead of
        // discarding a successful custom-field reconciliation.
        if (customValues.length && forceAsset.scanTableId) saved = await productionApi.forceLookup(forceAsset.machine_sn);
        else throw error;
      }
      // Keep the canonical row projection in sync when possible. The force
      // endpoint above is authoritative; a legacy row API failure must not
      // roll back or hide a successful force edit.
      if (forceAsset.scanTableId && forceAsset.scanRowNumber && customValues.length) {
        await productionApi.saveScanRow(Number(forceAsset.scanTableId), Number(forceAsset.scanRowNumber), customValues).catch(() => undefined);
      }
      setForceAsset(saved);
      const refreshed = await productionApi.completedScanTables().catch(() => []);
      setCompletedTables(refreshed || []);
      window.dispatchEvent(new CustomEvent('slss-scan-table-updated', { detail: { machineSn: forceAsset.machine_sn, saved: true } }));
      setMessage(`整机 ${forceAsset.machine_sn} 的完工扫码数据已强制修改并保存`);
    } catch (error:any) { setMessage(error?.message || '强制修改保存失败'); }
    finally { setForceLoading(false); }
  };
  const addForceColumn = async (afterTypeOverride?: string, labelOverride?: string, inheritLabelOverride?: boolean, positionOverride: 'before'|'after' = 'after') => {
    const label = (labelOverride ?? forceColumnLabel).trim();
    if (!forceAsset || !label) { setMessage('请输入新增行名称'); return false; }
    const afterType = afterTypeOverride ?? forceColumnAfter;
    setForceLoading(true);
    try {
      const created = await productionApi.forceAddCompletedColumn(forceAsset.machine_sn, label, 'SN', afterType, inheritLabelOverride ?? Boolean(afterTypeOverride), positionOverride);
      setForceAsset((asset:any) => {
        const components = [...(asset.components || [])];
        let insertAfter = afterType ? components.findIndex((item:any) => String(item.fieldKey || '') === afterType || String(item.type || '') === afterType) : -1;
        if(positionOverride === 'before' && insertAfter >= 0) insertAfter -= 1;
        const next = { type: label, fieldKey: created?.key || '', model: '', serialNo: '', operatorNo: '' };
        components.splice(insertAfter < 0 ? components.length : insertAfter + 1, 0, next);
        return { ...asset, components };
      });
      // Reload the authoritative completed-table snapshot so the newly added
      // column is immediately visible in 已完工/批次明细 on this account.
      const refreshed = await productionApi.completedScanTables().catch(() => []);
      setCompletedTables(refreshed || []);
      setStatisticsBatchDetail((current:any) => current?.id ? (refreshed || []).find((item:any) => String(item.id) === String(current.id)) || current : current);
      // Reload the authoritative asset projection as well. This guarantees
      // the newly inserted row is visible in the force-edit grid even when
      // the server normalized the field key or insertion order.
      const refreshedAsset = await productionApi.forceLookup(forceAsset.machine_sn).catch(() => null);
      if (refreshedAsset) setForceAsset(refreshedAsset);
      window.dispatchEvent(new CustomEvent('slss-scan-table-updated', { detail: { machineSn: forceAsset.machine_sn, label } }));
      setForceColumnLabel('');
      setMessage(`已强制增加“${label}”列，可编辑后保存并同步到扫码表、生产查询和维修数据。`);
      return true;
    } catch (error:any) { setMessage(error?.message || '强制增加列失败'); return false; }
    finally { setForceLoading(false); }
  };
  const deleteForceColumn = async (label: string, occurrence = 0, fieldKey = '') => {
    if (!forceAsset || !label || !canDeleteProductionColumn) return;
    if (!window.confirm(`确认删除“${label}”列？删除后将同步到扫码表、生产查询和维修数据。`)) return;
    setForceLoading(true);
    try {
      await productionApi.forceDeleteCompletedColumn(forceAsset.machine_sn, label, occurrence, fieldKey);
      setForceAsset((asset:any) => {
        if (fieldKey) {
          return { ...asset, components: (asset.components || []).filter((item:any) => String(item.fieldKey || '') !== fieldKey) };
        }
        let seen = 0;
        return { ...asset, components: (asset.components || []).filter((item:any) => {
          if (String(item.type || '') !== label) return true;
          const remove = seen === occurrence; seen += 1; return !remove;
        }) };
      });
      window.dispatchEvent(new CustomEvent('slss-scan-table-updated', { detail: { machineSn: forceAsset.machine_sn, deletedLabel: label } }));
      setMessage(`已删除“${label}”列，并同步到相关模块。`);
    } catch (error:any) { setMessage(error?.message || '删除列失败'); }
    finally { setForceLoading(false); }
  };
  const addForceRow = async (targetIndex: number, direction: 'above' | 'below') => {
    const components = forceAsset?.components || [];
    const target = components[targetIndex];
    if (!forceAsset || !target) return;
    // Row-level “＋下方/上方” always inherits the clicked row label.  Do not
    // reuse the global footer input, which may still contain the label from a
    // previous insertion (that was why clicking 网卡 SN could create 硬盘 SN).
    const label = '未命名配件';
    const anchor = String(target.fieldKey || target.type || '');
    setMessage(`正在“${label}”${direction === 'below' ? '下方' : '上方'}增加“${label}”行…`);
    // Row additions start with an intentionally blank display name; the
    // operator fills it in and commits it with “保存更改并同步”.
    const added = await addForceColumn(anchor, label, false, direction === 'above' ? 'before' : 'after');
    if (!added) return;
    // addForceColumn already inserts at the requested anchor (field key for
    // duplicate labels, label as a legacy fallback). Do not perform a second
    // index-based move, which could select the wrong duplicate row.
  };
  const loadRepairAsset = async () => {
    if (!repairMachineSn.trim()) return;
    setRepairLoading(true); setMessage('');
    try {
      const entered = repairMachineSn.trim();
      let machineSn = entered;
      let asset: any;
      try { asset = await productionApi.getAsset(entered); }
      catch {
        // A newly created/scan-only row may not have an Asset record yet.
        // Resolve it directly from the persisted scan table instead of
        // resolving a machine SN and querying the asset table a second time.
        asset = await productionApi.repairLookup(entered);
        machineSn = asset.machine_sn || asset.machineSn || entered;
      }
      asset = { ...asset, components: (asset.components || []).map((component:any) => ({ ...component, _originalSerialNo: component.serialNo || '' })) };
      // Scan-only rows are valid repair targets even before a legacy Asset
      // record is materialized. They have no lifecycle relation yet.
      const history = asset.scanOnly ? [] : await api.lifecycle(machineSn).catch(() => []);
      setRepairMachineSn(machineSn); setRepairAsset(asset); setRepairHistory((history || []).filter((event:any) => event.eventType === 'REPAIR_SWAP' || event.event_type === 'REPAIR_SWAP'));
    }
    catch (error:any) { setRepairAsset(null); setRepairHistory([]); setMessage(error?.message || '未找到该整机的生产扫码数据'); }
    finally { setRepairLoading(false); }
  };
  const saveRepairAsset = async () => {
    if (!repairAsset) return;
    // Only submit components whose SN actually changed.  Sending the entire
    // device snapshot made the backend interpret untouched components (for
    // example a power module) as replacement requests and require a fault
    // description for them.
    const changedComponents = (repairAsset.components || []).filter((component:any) =>
      String(component.serialNo || '').trim() !== String(component._originalSerialNo || '').trim()
    );
    const missingFault = changedComponents.find((component:any) => !String(component.faultDescription || '').trim());
    if (missingFault) { setMessage(`配件 ${missingFault.type || ''} 更换时必须填写故障描述`); return; }
    if (!changedComponents.length) { setMessage('未检测到配件 SN 变化，无需保存。'); return; }
    setRepairLoading(true);
    try {
      const saved = await productionApi.forceUpdateCompletedAsset(repairAsset.machine_sn, changedComponents);
      // Scan-table-only devices do not have a legacy asset/lifecycle row yet;
      // the save response already contains the current repair data.
      const history = saved?.scanOnly ? [] : await api.lifecycle(repairAsset.machine_sn).catch(() => []);
      setRepairHistory((history || []).filter((event:any) => event.eventType === 'REPAIR_SWAP' || event.event_type === 'REPAIR_SWAP'));
      setRepairAsset(null);
      setMessage(`整机 ${repairAsset.machine_sn} 的配件 SN 已保存并同步到流程单及其他模块`);
    } catch (error:any) { setMessage(error?.message || '生产维修保存失败'); }
    finally { setRepairLoading(false); }
  };
  const loadProductionStatistics = async () => {
    if (!statisticsRange.from || !statisticsRange.to) {
      setStatisticsError('请选择完整的开始日期和结束日期');
      setProductionStatistics(null);
      return;
    }
    if (statisticsRange.to < statisticsRange.from) {
      setStatisticsError('结束日期不能早于开始日期');
      setProductionStatistics(null);
      return;
    }
    setStatisticsLoading(true);
    setStatisticsError('');
    try {
      const result = await productionApi.statistics(statisticsRange.from, statisticsRange.to, statisticsSection === 'repair' ? repairStatisticsSn : productionStatisticsSn);
      setProductionStatistics(result);
      setSelectedStatisticsBatches([]);
      setSelectedRepairDevices([]);
      if (statisticsSection === 'production' && productionStatisticsSn.trim()) {
        const rows = [...(result.completedDevices || []), ...(result.unfinishedDevices || [])];
        setSelectedStatisticsBatches([...new Set(rows.map((row:any) => String(row.scanTableId || row.batchName || `${row.customerName || ''}/${row.model || ''}`))) ]);
      }
    }
    catch (error:any) {
      setProductionStatistics(null);
      setStatisticsError(error?.message || '生产统计查询失败，请稍后重试');
    }
    finally { setStatisticsLoading(false); }
  };
  const exportProductionStatistics = async () => {
    if (!productionStatistics) return;
    const XLSX = await import('xlsx');
    let rows: any[];
    if (statisticsSection === 'production') {
      if (!selectedStatisticsBatches.length) {
        setStatisticsError('请先勾选需要导出的批次');
        return;
      }
      const selectedKeys = new Set(selectedStatisticsBatches);
      const tables = await productionApi.scanTablesAll();
      const selectedTables = (tables || []).filter((table: any) => selectedKeys.has(String(table.id)) || selectedKeys.has(`${table.customerName || ''} / ${table.model || ''}`));
      rows = selectedTables.flatMap((table: any) => {
        const fields = table.template?.fields || [];
        return (table.rows || []).filter((scanRow: any) => {
          if (!productionStatisticsSn.trim()) return true;
          const query = productionStatisticsSn.trim().toLowerCase();
          return (scanRow.values || []).some((value:any) => String(value.value ?? value.fieldValue ?? '').trim().toLowerCase() === query);
        }).map((scanRow: any) => {
          const values = Object.fromEntries((scanRow.values || []).map((value: any) => [value.fieldKey || value.field_key, value.value ?? value.fieldValue ?? '']));
          const exported: Record<string, any> = {
            客户名称: table.customerName || '',
            整机型号: table.model || '',
            派工单号: table.dispatchOrderNo || '',
          };
          const labelCounts: Record<string, number> = {};
          fields.forEach((field: any) => {
            const baseLabel = field.fieldLabel || field.label || field.fieldKey || field.key;
            const occurrence = (labelCounts[baseLabel] || 0) + 1;
            labelCounts[baseLabel] = occurrence;
            // Templates may intentionally contain repeated columns such as
            // multiple 内存 SN / 硬盘 SN fields. Object keys must be unique or
            // later values overwrite earlier values during Excel export.
            const exportLabel = occurrence === 1 ? baseLabel : `${baseLabel} ${occurrence}`;
            exported[exportLabel] = values[field.fieldKey || field.key] || '';
          });
          return exported;
        });
      });
      // A statistics row can still be exported if its table was removed between
      // querying and exporting; retain a useful summary instead of a blank file.
      if (!rows.length) rows = productionSummaryRows.filter(row => selectedKeys.has(statisticsBatchKey(row))).flatMap((row: any) => [
        { 状态: row.state || '', 客户名称: row.customerName || '', 整机型号: row.model || '', 整机SN: (row.machineSns || []).join('、'), 批次: row.batchName || '' },
      ]);
    } else {
      if (!selectedRepairDevices.length) { setStatisticsError('请先勾选需要导出的维修批次'); return; }
      const selectedKeys = new Set(selectedRepairDevices);
      rows = (productionStatistics.repairDevices || []).filter((row:any) => selectedKeys.has(String(row.machineSn || row.batchName || ''))).flatMap((row:any) => (row.events || []).map((event:any) => ({ 整机型号: row.model || '', 整机SN: row.machineSn || '', 配件: event.partName || '配件', 旧SN: event.oldSn || '', 新SN: event.newSn || '', 故障描述: event.faultDescription || event.fault_description || '', 维修时间: event.occurredAt ? new Date(event.occurredAt).toLocaleString() : '', 维修操作员: event.operatorNo || event.operator_no || '' })));
    }
    if (!rows.length) { setStatisticsError('当前没有可导出的统计数据'); return; }
    const worksheet:any = XLSX.utils.json_to_sheet(rows);
    if (worksheet['!ref']) { const range = XLSX.utils.decode_range(worksheet['!ref']); for (let r = range.s.r; r <= range.e.r; r++) for (let c = range.s.c; c <= range.e.c; c++) { const cell:any = worksheet[XLSX.utils.encode_cell({ r, c })]; if (cell && cell.v !== undefined && String(cell.v) !== '') cell.s = { border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } } }; } }
    worksheet['!cols'] = Object.keys(rows[0]).map(key => ({ wch: key.includes('SN') ? 26 : 20 }));
    const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, worksheet, statisticsSection === 'production' ? '生产统计' : '维修统计');
    XLSX.writeFile(workbook, `生产统计_${statisticsRange.from}_${statisticsRange.to}_${statisticsSection === 'production' ? '生产' : '维修'}.xlsx`, { cellStyles: true });
  };
  const openStatisticsBatch = async (row: any) => {
    try {
      const tables = await productionApi.scanTablesAll();
      const table = (tables || []).find((item:any) => String(item.id) === String(row.scanTableId))
        || (tables || []).find((item:any) => `${item.customerName || ''} / ${item.model || ''}` === row.batchName);
      if (!table) throw new Error('未找到该批次扫码明细');
      setStatisticsBatchDetail(table);
    } catch (error:any) {
      setStatisticsError(error?.message || '加载批次明细失败');
    }
  };
  const applyPayload = () => {
    if (!selected) return;
    const raw = payload.trim();
    if (!raw) return;
    let parsed: Record<string, string> = {};
    try {
      const json = JSON.parse(raw);
      if (json && typeof json === 'object') parsed = Object.fromEntries(Object.entries(json).map(([k, v]) => [k, String(v ?? '')]));
    } catch {
      raw.split('|').forEach((value, index) => {
        const field = selected.fields[index];
        if (field) parsed[field.key] = value.trim();
      });
    }
    setValues(prev => ({ ...prev, ...parsed }));
    const missing = selected.fields.filter(f => f.required && !parsed[f.key] && !values[f.key]).map(f => f.label);
    setMessage(missing.length ? `缺少必填字段：${missing.join('、')}` : '扫码数据已按模板自动填充，可继续同步生产批次');
  };

  const tabs = [
    ...(canUseTemplate ? [{ id: 'entry' as const, label: '创建流程单', icon: ScanLine }] : []),
    { id: 'tables' as const, label: '流程单', icon: ClipboardList },
    ...(canManageRepair ? [{ id: 'repair' as const, label: '生产维修', icon: Wrench }] : []),
    { id: 'query' as const, label: '生产数据查询', icon: Database },
    ...(canManageTemplates ? [{ id: 'templates' as const, label: '生产模板配置', icon: Settings2 }] : []),
  ];

  return (
    <PageContainer className="slss-mes-page min-h-full bg-[var(--color-background)] p-4 md:p-7">
      <header className="rounded-2xl px-6 py-7 text-white shadow-xl">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.28em] text-cyan-300">Manufacturing Execution System</p>
            <h1 className="mt-2 text-3xl font-semibold">生产 MES 工作台</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-300">生产录入、扫码模板和生产资产查询统一在一个工作台完成。</p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
            <ClipboardList size={18} className="text-cyan-300" /> 生产制造限界上下文
          </div>
        </div>
      </header>

      <div className="mt-5 flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => { setTab(id); if (id === 'entry') refreshTemplates(); }} className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${tab === id ? 'theme-accent-bg shadow' : 'text-slate-600 hover:bg-slate-100'}`}>
            <Icon size={16} />{label}
          </button>
        ))}
      </div>

      {tab === 'entry' && (
        <section className="mt-5 space-y-5">
          {canUseTemplate && <div className="rounded-xl border border-cyan-100 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
              <label className="flex-1 text-sm font-semibold text-slate-700">
                创建流程单
                <select value={selectedId} onChange={e => { setSelectedId(e.target.value); setValues({}); setMessage(''); }} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal">
                  <option value="">请选择模板（例如：5517FEF）</option>
                  {templates.filter(t => t.active).map(t => <option key={t.id} value={t.id}>{t.model ? `${t.model} · ${t.name}` : t.name}</option>)}
                </select>
              </label>
              <button onClick={refreshTemplates} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">刷新模板</button>
            </div>
            {selected && (
              <div className="mt-4 flex flex-col gap-3 rounded-lg border border-cyan-100 bg-cyan-50/60 p-4 md:flex-row md:items-end">
                <label className="w-full text-sm font-semibold text-slate-700 md:w-56">
                  派工单号
                  <input value={dispatchOrderNo} onChange={e => setDispatchOrderNo(e.target.value)} placeholder="填写派工单号" className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal" />
                </label>
                <label className="w-full text-sm font-semibold text-slate-700 md:w-56">
                  整机数量
                  <input type="number" min={1} max={5000} value={quantity} onChange={e => setQuantity(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal" />
                </label>
                <label className="flex min-h-[42px] cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700">
                  <input type="checkbox" checked={disableAutoFillPartModels} onChange={e => setDisableAutoFillPartModels(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-cyan-700 focus:ring-cyan-600" />
                  配件型号不自动生成
                </label>
                <button onClick={useTemplate} className="rounded-lg bg-cyan-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-cyan-800">选择并生成录入表</button>
                <p className="text-xs text-slate-500">确认后将自动生成对应数量的「{selected.name}」待录入行。</p>
              </div>
            )}
            {message && <div className={`mt-4 flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${message.startsWith('缺少') ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>{message.startsWith('缺少') ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}{message}</div>}
          </div>}
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">流程单创建完成后，请进入“流程单”模块选择对应流程单进行明细录入。</div>
        </section>
      )}
      {tab === 'tables' && <section className="mt-5 rounded-xl border border-cyan-100 bg-white p-5 shadow-sm">
        {!selectedScanCustomer && <>
          <div className="mb-4"><h2 className="text-xl font-bold text-slate-900">流程单客户</h2><p className="mt-1 text-sm text-slate-500">请选择客户，进入该客户已创建的整机型号流程单。</p></div>
          {scanCustomers.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{scanCustomers.map(customer => {
            const tables = activeScanTables.filter(table => table.name?.trim() === customer);
            const modelCount = new Set(tables.map(table => table.model)).size;
            return <button key={customer} onClick={() => { setSelectedScanCustomer(customer); setSelectedScanTableId(''); setSelectedScanTableSnapshot(null); setConfirmedTemplate(null); setConfirmedQuantity(undefined); }} className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-left transition hover:-translate-y-0.5 hover:border-cyan-400 hover:bg-cyan-50 hover:shadow">
              <div className="flex items-center justify-between"><span className="rounded bg-cyan-100 px-2 py-1 text-xs font-bold text-cyan-800">客户</span><span className="text-xs text-slate-400">{tables.length} 张流程单</span></div>
              <h3 className="mt-4 text-lg font-bold text-slate-900">{customer}</h3>
              <div className="mt-2 text-sm text-slate-600">整机型号：<b>{modelCount}</b> 种</div>
              <div className="mt-3 text-xs text-cyan-700">查看该客户的整机型号 →</div>
            </button>;
          })}</div> : <div className="rounded-lg border border-dashed p-10 text-center text-sm text-slate-500">暂无流程单，请先进入“创建流程单”创建流程单。</div>}
        </>}

        {selectedScanCustomer && !selectedScanTable && <>
          <button onClick={() => { setSelectedScanCustomer(''); setSelectedScanTableId(''); setSelectedScanTableSnapshot(null); setConfirmedTemplate(null); setConfirmedQuantity(undefined); }} className="mb-4 inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-800"><ArrowLeft size={16} />返回客户列表</button>
          <div className="mb-4"><h2 className="text-xl font-bold text-slate-900">{selectedScanCustomer}</h2><p className="mt-1 text-sm text-slate-500">请选择整机型号，进入对应流程单明细。</p></div>
          {customerScanTables.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{customerScanTables.map(table => <div key={table.id} className="relative rounded-xl border border-slate-200 bg-slate-50 transition hover:-translate-y-0.5 hover:border-cyan-400 hover:bg-cyan-50 hover:shadow">
            <button onClick={() => { setSelectedScanTableId(table.id); setSelectedScanTableSnapshot(table); setConfirmedTemplate(table.template); setConfirmedQuantity(table.quantity); }} className="block w-full p-5 text-left">
              <div className="flex items-center justify-between pr-8"><span className="rounded bg-cyan-100 px-2 py-1 text-xs font-bold text-cyan-800">整机型号</span><span className="text-xs text-slate-400">{new Date(table.createdAt).toLocaleString()}</span></div>
              <h3 className="mt-4 text-lg font-bold text-slate-900">{table.model}</h3>
              <div className="mt-2 text-sm text-slate-600">派工单号：<b>{table.dispatchOrderNo || '—'}</b> · 整机数量：<b>{table.quantity}</b> 台 · 字段列数：<b>{table.template?.fields?.length || 0}</b></div>
              <div className="mt-3 text-xs text-cyan-700">进入流程单明细 →</div>
            </button>
            <div className="absolute right-3 top-3 flex gap-1">{canDeleteScanTable && <button type="button" onClick={() => deleteScanTable(table)} title="删除流程单" aria-label={`删除 ${table.model} 流程单`} className="rounded-lg border border-red-200 bg-white p-2 text-red-500 shadow-sm hover:bg-red-50 hover:text-red-700"><Trash2 size={16} /></button>}</div>
          </div>)}</div> : <div className="rounded-lg border border-dashed p-10 text-center text-sm text-slate-500">该客户暂无流程单。</div>}
        </>}

        {selectedScanCustomer && selectedScanTable && <>
          <button onClick={() => { setSelectedScanTableId(''); setSelectedScanTableSnapshot(null); setConfirmedTemplate(null); setConfirmedQuantity(undefined); }} className="mb-4 inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-800"><ArrowLeft size={16} />返回整机型号列表</button>
          <div className="mb-4 flex flex-col gap-2 border-b border-slate-100 pb-4 md:flex-row md:items-end md:justify-between">
            <div><p className="text-xs font-bold uppercase tracking-wider text-cyan-700">{selectedScanCustomer}</p><h2 className="mt-1 text-xl font-bold text-slate-900">{selectedScanTable.model} 流程单明细</h2></div>
            <div className="text-sm text-slate-500">派工单号：{selectedScanTable.dispatchOrderNo || '—'} · 创建时间：{new Date(selectedScanTable.createdAt).toLocaleString()} · 整机数量：{selectedScanTable.quantity} 台</div>
          </div>
          {confirmedTemplate && <ProductionImport
            selectedTemplate={confirmedTemplate}
            initialQuantity={confirmedQuantity}
            dispatchOrderNo={selectedScanTable.dispatchOrderNo}
            disableAutoFillPartModels={selectedScanTable.disableAutoFillPartModels}
            permissions={sessionPermissions}
            scanTableId={selectedScanTable.id}
            initialRows={selectedScanTable.rows}
            onBatchCompleted={() => {
              const completedId = selectedScanTable.id;
              setScanTables(previous => {
                const next = previous.filter(item => item.id !== completedId);
                return next;
              });
              setSelectedScanTableId('');
              setConfirmedTemplate(null);
              setConfirmedQuantity(undefined);
              setMessage('该批次已全部完工，已从流程单中隐藏，可在生产数据查询中查看。');
            }}
          />}
        </>}
      </section>}
      {tab === 'repair' && <section className="mt-5 rounded-xl border border-amber-200 bg-white p-5 shadow-sm">
        <div className="mb-5 flex items-center gap-3 border-b border-amber-100 pb-4"><div className="rounded-lg bg-amber-100 p-2 text-amber-700"><Wrench size={20} /></div><div><h2 className="text-xl font-bold text-slate-900">生产维修</h2><p className="mt-1 text-sm text-slate-500">输入整机或配件 SN 调取对应流程单，仅可修改需要更换的配件 SN。</p></div></div>
        <div className="ds-filter-bar">
          <label className="ds-form-field flex-1 text-sm font-semibold text-slate-700">整机/配件 SN<input value={repairMachineSn} onChange={e => setRepairMachineSn(e.target.value)} onKeyDown={e => e.key === 'Enter' && loadRepairAsset()} placeholder="输入或扫描整机/配件 SN" className="ds-input mt-1 w-full font-mono font-normal" /></label>
          <button onClick={loadRepairAsset} disabled={repairLoading || !repairMachineSn.trim()} className="rounded-lg bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-slate-300">{repairLoading ? '加载中…' : '查询流程单'}</button>
        </div>
        {repairAsset && <div className="mt-5 overflow-x-auto rounded-lg border border-amber-200">
          <div className="flex items-center justify-between bg-amber-50 px-4 py-3 text-sm"><span>整机型号：<b>{repairAsset.model || '未设置'}</b> · 整机 SN：<b className="font-mono">{repairAsset.machine_sn}</b></span><button onClick={saveRepairAsset} disabled={repairLoading} className="rounded bg-amber-600 px-4 py-2 font-semibold text-white hover:bg-amber-700 disabled:bg-slate-300">保存并同步</button></div>
          <table className="min-w-full text-sm"><thead className="bg-slate-50 text-left text-xs text-slate-500"><tr><th className="px-4 py-3">配件类型</th><th className="px-4 py-3">配件型号</th><th className="px-4 py-3">配件 SN（可修改）</th><th className="px-4 py-3">故障描述 <span className="text-red-500">*</span></th></tr></thead><tbody className="divide-y">{(repairAsset.components || []).map((component:any, index:number) => <tr key={`${component.type}-${index}`}><td className="px-4 py-3 font-medium">{component.type}</td><td className="px-4 py-2"><input value={component.model || ''} onChange={e => setRepairAsset((asset:any) => ({ ...asset, components: asset.components.map((item:any, i:number) => i === index ? { ...item, model: e.target.value } : item) }))} className="w-full rounded border px-2 py-1.5" /></td><td className="px-4 py-2"><input value={component.serialNo || ''} onChange={e => setRepairAsset((asset:any) => ({ ...asset, components: asset.components.map((item:any, i:number) => i === index ? { ...item, serialNo: e.target.value } : item) }))} className="w-full rounded border px-2 py-1.5 font-mono" /></td><td className="px-4 py-2"><input value={component.faultDescription || ''} placeholder="更换配件时必填" onChange={e => setRepairAsset((asset:any) => ({ ...asset, components: asset.components.map((item:any, i:number) => i === index ? { ...item, faultDescription: e.target.value } : item) }))} className="w-full min-w-[220px] rounded border px-2 py-1.5" /></td></tr>)}</tbody></table>
        </div>}
        {repairHistory.length > 0 && <div className="mt-5 rounded-lg border border-slate-200"><div className="bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">配件维修痕迹（{repairHistory.length} 次）</div><div className="divide-y">{repairHistory.slice().reverse().map((event:any, index:number) => <div key={event.id || index} className="grid gap-2 px-4 py-3 text-sm md:grid-cols-[1fr_1fr_1fr_1.5fr]"><span className="font-medium text-slate-700">{event.partName || event.part_name || '配件'}</span><span className="font-mono text-red-600">旧：{event.oldSn || event.old_sn || '—'}</span><span className="font-mono text-emerald-700">新：{event.newSn || event.new_sn || '—'}</span><span className="text-xs text-slate-500">{event.faultDescription || event.fault_description ? `故障描述：${event.faultDescription || event.fault_description} · ` : ''}{event.occurredAt || event.occurred_at ? new Date(event.occurredAt || event.occurred_at).toLocaleString() : ''} · {event.details || ''}</span></div>)}</div></div>}
        {message && <div className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</div>}
      </section>}
      {tab === 'query' && <div className="mt-5 space-y-5">
        <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
          <button onClick={() => setQuerySection('scan')} className={`rounded-lg px-4 py-2 text-sm font-semibold ${querySection === 'scan' ? 'theme-accent-bg' : 'text-slate-600 hover:bg-slate-100'}`}>扫码数据查询</button>
          <button onClick={() => setQuerySection('statistics')} className={`rounded-lg px-4 py-2 text-sm font-semibold ${querySection === 'statistics' ? 'theme-accent-bg' : 'text-slate-600 hover:bg-slate-100'}`}>生产统计查询</button>
          <button onClick={() => setQuerySection('unfinished')} className={`rounded-lg px-4 py-2 text-sm font-semibold ${querySection === 'unfinished' ? 'theme-accent-bg' : 'text-slate-600 hover:bg-slate-100'}`}>未完工</button>
          <button onClick={() => setQuerySection('completed')} className={`rounded-lg px-4 py-2 text-sm font-semibold ${querySection === 'completed' ? 'theme-accent-bg' : 'text-slate-600 hover:bg-slate-100'}`}>已完工</button>
        </div>
        {querySection === 'scan' && <ProductionList />}
        {querySection === 'completed' && <section className="rounded-xl border border-emerald-100 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center justify-between border-b border-emerald-100 pb-4"><div><h2 className="text-xl font-bold text-slate-900">已完工流程单</h2><p className="mt-1 text-sm text-slate-500">所有设备完成完工确认后的流程单，点击即可查看完整扫码明细。</p></div><button type="button" onClick={() => { setCompletedLoading(true); productionApi.completedScanTables().then(items => setCompletedTables(items || [])).catch((error:any) => setCompletedError(error?.message || '已完工流程单加载失败')).finally(() => setCompletedLoading(false)); }} className="rounded-lg border border-emerald-200 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50">刷新</button></div>
          {completedError && <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{completedError}</div>}
          {completedLoading ? <div className="rounded-lg border border-dashed p-10 text-center text-sm text-slate-500">正在加载已完工流程单…</div> : completedTables.length ? <div className="overflow-x-auto rounded-lg border"><table className="min-w-full text-sm"><thead className="bg-emerald-50 text-left text-xs text-emerald-800"><tr><th className="px-4 py-3">客户名称</th><th className="px-4 py-3">整机型号</th><th className="px-4 py-3">整机数量</th><th className="px-4 py-3">完工时间</th><th className="px-4 py-3">操作</th></tr></thead><tbody className="divide-y">{completedTables.map((table:any) => <tr key={table.id} className="hover:bg-emerald-50/40"><td className="px-4 py-3 font-medium">{table.customerName || '—'}</td><td className="px-4 py-3 font-semibold">{table.model || '—'}</td><td className="px-4 py-3">{table.quantity || table.rows?.length || 0} 台</td><td className="px-4 py-3 text-xs text-slate-500">{table.completedAt ? new Date(table.completedAt).toLocaleString() : (table.updatedAt ? new Date(table.updatedAt).toLocaleString() : new Date(table.createdAt).toLocaleString())}</td><td className="px-4 py-3"><button type="button" onClick={() => setStatisticsBatchDetail(table)} className="font-semibold text-cyan-700 underline underline-offset-2 hover:text-cyan-900">查看完整明细</button></td></tr>)}</tbody></table></div> : <div className="rounded-lg border border-dashed p-10 text-center text-sm text-slate-500">暂无已完工流程单。</div>}
        </section>}
        {querySection === 'unfinished' && <section className="rounded-xl border border-amber-100 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center justify-between border-b border-amber-100 pb-4"><div><h2 className="text-xl font-bold text-slate-900">未完工流程单</h2><p className="mt-1 text-sm text-slate-500">显示所有仍在生产中的设备，点击查看组装及其他已录入流程明细。</p></div><button type="button" onClick={() => { setUnfinishedLoading(true); productionApi.unfinishedScanTables().then(items => setUnfinishedTables(items || [])).catch((error:any) => setUnfinishedError(error?.message || '未完工流程单加载失败')).finally(() => setUnfinishedLoading(false)); }} className="rounded-lg border border-amber-200 px-3 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-50">刷新</button></div>
          {unfinishedError && <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{unfinishedError}</div>}
          {unfinishedLoading ? <div className="rounded-lg border border-dashed p-10 text-center text-sm text-slate-500">正在加载未完工流程单…</div> : unfinishedTables.length ? <div className="overflow-x-auto rounded-lg border"><table className="min-w-full text-sm"><thead className="bg-amber-50 text-left text-xs text-amber-800"><tr><th className="px-4 py-3">客户名称</th><th className="px-4 py-3">整机型号</th><th className="px-4 py-3">整机数量</th><th className="px-4 py-3">创建时间</th><th className="px-4 py-3">操作</th></tr></thead><tbody className="divide-y">{unfinishedTables.map((table:any) => <tr key={table.id} className="hover:bg-amber-50/40"><td className="px-4 py-3 font-medium">{table.customerName || '—'}</td><td className="px-4 py-3 font-semibold">{table.model || '—'}</td><td className="px-4 py-3">{table.quantity || table.rows?.length || 0} 台</td><td className="px-4 py-3 text-xs text-slate-500">{table.createdAt ? new Date(table.createdAt).toLocaleString() : '—'}</td><td className="px-4 py-3"><button type="button" onClick={() => setStatisticsBatchDetail(table)} className="font-semibold text-cyan-700 underline underline-offset-2 hover:text-cyan-900">查看完整明细</button></td></tr>)}</tbody></table></div> : <div className="rounded-lg border border-dashed p-10 text-center text-sm text-slate-500">暂无未完工设备。</div>}
        </section>}
        {querySection === 'statistics' && <section className="rounded-xl border border-emerald-100 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap gap-2 border-b border-slate-100 pb-4">
            <button onClick={() => setStatisticsSection('production')} className={`rounded-lg px-4 py-2 text-sm font-semibold ${statisticsSection === 'production' ? 'theme-accent-bg' : 'text-slate-600 hover:bg-slate-50'}`}>生产数据查询</button>
            <button onClick={() => setStatisticsSection('repair')} className={`rounded-lg px-4 py-2 text-sm font-semibold ${statisticsSection === 'repair' ? 'theme-accent-bg' : 'text-slate-600 hover:bg-slate-50'}`}>维修数据查询</button>
          </div>
          <div className="ds-filter-bar mt-5">
            <label className="ds-form-field text-sm font-semibold text-slate-700">开始日期<input type="date" value={statisticsRange.from} onChange={e => setStatisticsRange(range => ({ ...range, from: e.target.value }))} className="ds-input mt-1 block font-normal" /></label>
            <label className="ds-form-field text-sm font-semibold text-slate-700">结束日期<input type="date" value={statisticsRange.to} onChange={e => setStatisticsRange(range => ({ ...range, to: e.target.value }))} className="ds-input mt-1 block font-normal" /></label>
            {statisticsSection === 'production' && <label className="ds-form-field min-w-[240px] flex-1 text-sm font-semibold text-slate-700">整机 / 配件 SN（可选）<input value={productionStatisticsSn} onChange={e => setProductionStatisticsSn(e.target.value)} onKeyDown={e => e.key === 'Enter' && loadProductionStatistics()} placeholder="输入任意整机或配件 SN" className="ds-input mt-1 block w-full font-mono font-normal" /></label>}
            {statisticsSection === 'repair' && <label className="ds-form-field min-w-[240px] flex-1 text-sm font-semibold text-slate-700">整机 / 配件 SN（可选）<input value={repairStatisticsSn} onChange={e => setRepairStatisticsSn(e.target.value)} onKeyDown={e => e.key === 'Enter' && loadProductionStatistics()} placeholder="输入任意整机或配件 SN" className="ds-input mt-1 block w-full font-mono font-normal" /></label>}
            <button onClick={loadProductionStatistics} disabled={statisticsLoading} className="theme-accent-bg rounded-lg px-5 py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:bg-slate-300">{statisticsLoading ? '查询中…' : '查询统计'}</button>
          <button onClick={exportProductionStatistics} disabled={!productionStatistics || statisticsLoading || (statisticsSection === 'production' ? selectedStatisticsBatches.length === 0 : selectedRepairDevices.length === 0)} className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-5 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"><Download size={16} />导出已选批次 Excel</button>
          </div>
          {statisticsError && <div role="alert" className="mt-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"><AlertTriangle size={17} />{statisticsError}</div>}
          {productionStatistics && productionStatistics.completedCount === 0 && productionStatistics.unfinishedCount === 0 && productionStatistics.repairCount === 0 && <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-5 text-center text-sm text-slate-500">所选时间段内暂无生产或维修数据</div>}
          {productionStatistics && statisticsSection === 'production' && <div className="mt-5">
            <div className="grid gap-3 md:grid-cols-2"><div className="rounded-xl bg-emerald-50 p-4"><p className="text-sm text-emerald-700">完工设备</p><p className="mt-2 text-3xl font-bold text-emerald-800">{productionStatistics.completedCount}</p></div><div className="rounded-xl bg-amber-50 p-4"><p className="text-sm text-amber-700">未完工设备</p><p className="mt-2 text-3xl font-bold text-amber-800">{productionStatistics.unfinishedCount}</p></div></div>
            <div className="mt-5 mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500"><span>勾选需要导出的批次（已选 {selectedStatisticsBatches.length} 个）</span><button type="button" onClick={() => setSelectedStatisticsBatches([])} disabled={!selectedStatisticsBatches.length} className="rounded border border-slate-200 px-2.5 py-1 font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">清除选择</button></div>
            <div className="overflow-x-auto rounded-lg border"><table className="min-w-full text-sm"><thead className="bg-slate-50 text-left text-xs text-slate-500"><tr><th className="px-4 py-3"><input type="checkbox" aria-label="全选批次" checked={productionSummaryRows.length > 0 && productionSummaryRows.every((row:any) => selectedStatisticsBatches.includes(statisticsBatchKey(row)))} onChange={event => setSelectedStatisticsBatches(event.target.checked ? productionSummaryRows.map((row:any) => statisticsBatchKey(row)) : [])} /></th><th className="px-4 py-3">状态</th><th className="px-4 py-3">客户名称</th><th className="px-4 py-3">整机型号</th><th className="px-4 py-3">整机数量</th><th className="px-4 py-3">整机 SN</th><th className="px-4 py-3">批次</th></tr></thead><tbody className="divide-y">{productionSummaryRows.map((row:any, index:number) => { const key = statisticsBatchKey(row); return <tr key={`${key}-${index}`}><td className="px-4 py-3"><input type="checkbox" aria-label={`选择批次 ${row.batchName || row.model || index + 1}`} checked={selectedStatisticsBatches.includes(key)} onChange={event => setSelectedStatisticsBatches(previous => event.target.checked ? [...new Set([...previous, key])] : previous.filter(item => item !== key))} /></td><td className={`px-4 py-3 ${row.state === '已完工' ? 'text-emerald-700' : row.state === '部分完工' ? 'text-blue-700' : 'text-amber-700'}`}>{row.state}</td><td className="px-4 py-3">{row.customerName || (row.batchName || '').split(' / ')[0] || '—'}</td><td className="px-4 py-3">{row.model || '—'}</td><td className="px-4 py-3 font-semibold">{row.quantity}</td><td className="px-4 py-3 font-mono text-xs">{(row.machineSns || []).join('、') || '—'}</td><td className="px-4 py-3 text-xs"><button onClick={() => openStatisticsBatch(row)} className="font-semibold text-cyan-700 underline underline-offset-2 hover:text-cyan-900">{row.batchName || '查看批次'}</button></td></tr>; })}</tbody></table></div>
          </div>}
          {productionStatistics && statisticsSection === 'repair' && <div className="mt-5"><div className="rounded-xl bg-red-50 p-4"><p className="text-sm text-red-700">维修设备数量</p><p className="mt-2 text-3xl font-bold text-red-800">{productionStatistics.repairCount}</p></div><div className="mt-5 mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500"><span>{productionStatistics.repairQuery ? `SN 查询：${productionStatistics.repairQuery}` : '时间范围内全部维修记录'} · 勾选需要导出的维修设备（已选 {selectedRepairDevices.length} 个）</span><button type="button" onClick={() => setSelectedRepairDevices([])} disabled={!selectedRepairDevices.length} className="rounded border border-slate-200 px-2.5 py-1 font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">清除选择</button></div><div className="mt-5 overflow-x-auto rounded-lg border"><table className="min-w-full text-sm"><thead className="bg-slate-50 text-left text-xs text-slate-500"><tr><th className="px-4 py-3"><input type="checkbox" aria-label="全选维修批次" checked={(productionStatistics.repairDevices || []).length > 0 && (productionStatistics.repairDevices || []).every((row:any) => selectedRepairDevices.includes(String(row.machineSn || row.batchName || '')))} onChange={event => setSelectedRepairDevices(event.target.checked ? (productionStatistics.repairDevices || []).map((row:any) => String(row.machineSn || row.batchName || '')) : [])} /></th><th className="px-4 py-3">整机型号</th><th className="px-4 py-3">整机 SN</th><th className="px-4 py-3">维修配件</th><th className="px-4 py-3">旧 SN</th><th className="px-4 py-3">新 SN</th><th className="px-4 py-3">故障描述</th><th className="px-4 py-3">维修操作员</th><th className="px-4 py-3">维修时间</th><th className="px-4 py-3">维修备注</th></tr></thead><tbody className="divide-y">{(productionStatistics.repairDevices || []).flatMap((row:any) => (row.events || []).map((event:any, index:number) => { const key = String(row.machineSn || row.batchName || ''); return <tr key={`${row.machineSn}-${index}`}><td className="px-4 py-3"><input type="checkbox" aria-label={`选择维修批次 ${row.machineSn || row.batchName || ''}`} checked={selectedRepairDevices.includes(key)} onChange={event => setSelectedRepairDevices(previous => event.target.checked ? [...new Set([...previous, key])] : previous.filter(item => item !== key))} /></td><td className="px-4 py-3">{row.model || '—'}</td><td className="px-4 py-3 font-mono">{row.machineSn}</td><td className="px-4 py-3">{event.partName || '配件'}</td><td className="px-4 py-3 font-mono text-red-600">{event.oldSn || '—'}</td><td className="px-4 py-3 font-mono text-emerald-700">{event.newSn || '—'}</td><td className="px-4 py-3 text-amber-800">{event.faultDescription || event.fault_description || '—'}</td><td className="px-4 py-3 text-xs font-semibold text-cyan-700">{event.operatorNo || event.operator_no || '—'}</td><td className="px-4 py-3 text-xs text-slate-500">{event.occurredAt ? new Date(event.occurredAt).toLocaleString() : '—'}</td><td className="max-w-[280px] px-4 py-3 text-xs text-slate-500">{event.details || '—'}</td></tr>; }))}</tbody></table></div></div>}
        </section>}
        {statisticsBatchDetail && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" onClick={() => setStatisticsBatchDetail(null)}><div className="max-h-[85vh] w-full max-w-6xl overflow-hidden rounded-xl bg-white shadow-2xl" onClick={e => e.stopPropagation()}><div className="flex items-center justify-between border-b px-5 py-4"><div><h3 className="font-bold text-slate-900">批次扫码明细</h3><p className="mt-1 text-xs text-slate-500">{statisticsBatchDetail.customerName || ''} / {statisticsBatchDetail.model || ''} · 创建于 {statisticsBatchDetail.createdAt ? new Date(statisticsBatchDetail.createdAt).toLocaleString() : '—'}</p></div><button onClick={() => setStatisticsBatchDetail(null)} className="rounded px-3 py-1 text-slate-500 hover:bg-slate-100">关闭</button></div><div className="max-h-[70vh] overflow-auto p-4"><table className="min-w-full text-sm"><thead className="bg-slate-50"><tr><th className="px-3 py-2 text-left">序号</th>{(statisticsBatchDetail.template?.fields || []).map((field:any) => <th key={field.fieldKey || field.key} className="whitespace-nowrap px-3 py-2 text-left">{field.fieldLabel || field.label}</th>)}</tr></thead><tbody className="divide-y">{(statisticsBatchDetail.rows || []).map((row:any, index:number) => { const cellData=Object.fromEntries((row.values || []).map((v:any) => [v.fieldKey || v.field_key, { value: v.value ?? v.fieldValue ?? '', operatorNo: v.operatorNo || v.operator_no || '' }])); return <tr key={row.id || index}><td className="px-3 py-2">{row.rowNumber || index + 1}</td>{(statisticsBatchDetail.template?.fields || []).map((field:any) => { const key=field.fieldKey || field.key; const entry=cellData[key] || { value: '', operatorNo: '' }; const operator=entry.operatorNo; return <td key={key} className="whitespace-nowrap px-3 py-2 font-mono"><div>{entry.value || '—'}</div>{operator && <div className="mt-1 font-sans text-[11px] font-semibold text-cyan-700">操作员：{operator}</div>}</td>; })}</tr>; })}</tbody></table></div></div></div>}
        {querySection === 'statistics' && statisticsSection === 'production' && <div className={`rounded-xl border p-5 shadow-sm ${canForceEditCompleted ? 'border-amber-200 bg-white' : 'border-slate-200 bg-slate-100 opacity-70'}`}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
            <div className="flex-1"><h2 className="font-bold text-slate-900">强制修改完工数据</h2><p className="mt-1 text-xs text-slate-500">查询完工整机后，可直接修改该设备配件扫码数据。</p><input disabled={!canForceEditCompleted} value={forceMachineSn} onChange={e=>setForceMachineSn(e.target.value)} onKeyDown={e=>e.key==='Enter'&&loadForceAsset()} placeholder="输入已完工整机 SN" className="mt-3 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm disabled:cursor-not-allowed"/></div>
            <button type="button" disabled={!canForceEditCompleted||forceLoading} onClick={loadForceAsset} className={`rounded-lg px-5 py-2.5 text-sm font-semibold ${canForceEditCompleted?'bg-amber-500 text-white hover:bg-amber-600':'cursor-not-allowed bg-slate-300 text-slate-500'}`}>{forceLoading?'加载中…':'查询完工数据'}</button>
          </div>
          {!canForceEditCompleted && <p className="mt-3 text-xs font-medium text-slate-500">当前账号未开通“强制修改完工扫码数据”权限。</p>}
          {forceAsset && <section data-force-grid-version="2026-08-20-3" className="mt-5 rounded-lg border border-amber-200 bg-white p-4"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-semibold text-slate-900">设备配件行调整</h3><p className="text-xs text-slate-500">原模板字段（如硬盘 SN）保留生产数据；只有新增的自定义行可删除。新增行的型号和 SN 默认留空，请手动填写后点击保存并同步。</p></div></div><div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-amber-50 text-left text-xs text-amber-900"><tr><th className="px-3 py-2">配件行</th><th className="px-3 py-2">型号</th><th className="px-3 py-2">SN</th><th className="px-3 py-2">行操作</th></tr></thead><tbody className="divide-y">{(forceAsset.components || []).map((component:any,index:number)=>{ const isCustom=String(component.fieldKey||'').startsWith('force_'); return <tr key={`force-row-${component.fieldKey||component.type}-${index}`}><td className="px-3 py-2 font-semibold">{isCustom ? <input value={component.type === '未命名配件' ? '' : (component.type || '')} placeholder="填写配件名称" onChange={e=>setForceAsset((asset:any)=>({...asset,components:asset.components.map((item:any,i:number)=>i===index?{...item,type:e.target.value}:item)}))} className="w-full min-w-[160px] rounded border px-2 py-1.5 font-normal" /> : (component.type || '未命名配件')}</td><td className="px-3 py-2"><input value={component.model || ''} placeholder={isCustom ? '手动输入型号' : ''} readOnly={!isCustom} onChange={e=>setForceAsset((asset:any)=>({...asset,components:asset.components.map((item:any,i:number)=>i===index?{...item,model:e.target.value}:item)}))} className="w-full min-w-[180px] rounded border px-2 py-1.5" /></td><td className="px-3 py-2 font-mono"><input value={component.serialNo || ''} placeholder={isCustom ? '手动输入 SN' : ''} readOnly={!isCustom} onChange={e=>setForceAsset((asset:any)=>({...asset,components:asset.components.map((item:any,i:number)=>i===index?{...item,serialNo:e.target.value}:item)}))} className="w-full min-w-[220px] rounded border px-2 py-1.5 font-mono" /></td><td className="px-3 py-2"><div className="flex flex-wrap gap-1"><button type="button" disabled={forceLoading} onClick={() => addForceRow(index,'above')} className="rounded border border-amber-400 px-2 py-1 text-xs font-bold text-amber-700 hover:bg-amber-100 disabled:opacity-50">＋ 上方</button><button type="button" disabled={forceLoading} onClick={() => addForceRow(index,'below')} className="rounded border border-amber-400 px-2 py-1 text-xs font-bold text-amber-700 hover:bg-amber-100 disabled:opacity-50">＋ 下方</button><button type="button" title={!isCustom ? '原始模板行不可删除' : (canDeleteProductionColumn ? '删除这条新增配件行' : '需要删除生产列权限')} disabled={forceLoading || !isCustom || !canDeleteProductionColumn} onClick={() => { if (!isCustom) return; const occurrence=(forceAsset.components || []).slice(0,index+1).filter((item:any)=>String(item.fieldKey||'').startsWith('force_') && String(item.type||'')===String(component.type||'')).length-1; deleteForceColumn(String(component.type||''),Math.max(0,occurrence),String(component.fieldKey||'')); }} className="rounded border border-red-400 px-2 py-1 text-xs font-bold text-red-700 hover:bg-red-100 disabled:opacity-50">删除</button></div></td></tr>})}</tbody></table></div></section>}
          {forceAsset && <><div className="mt-4 flex items-center justify-end gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3"><span className="mr-auto text-xs text-amber-800">新增或删除行后，请点击保存更改，保存结果将同步到扫码表、已完工、生产查询和维修模块。</span><button type="button" disabled={forceLoading} onClick={saveForceAsset} className="rounded-lg bg-amber-600 px-5 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50">保存更改并同步</button></div></>}
        </div>}
      </div>}
      {tab === 'templates' && <div className="mt-5"><ProductionScanTemplates /></div>}
    </PageContainer>
  );
}
