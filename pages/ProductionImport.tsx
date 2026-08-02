
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FileSpreadsheet, Save, Plus, Trash2, RefreshCw, Database, ScanLine, X, Volume2, VolumeX, Wifi, WifiOff, Cloud, Check, Loader2, AlertCircle, Printer } from 'lucide-react';
import { Asset } from '../types';
import { productionApi } from '../services/apiClient';
import { useAuth } from '../components/AuthContext';

// Utility to generate batch name
const generateBatchName = () => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  return `PROD_${yyyy}${mm}${dd}_${hh}${min}`;
};

interface GridRow extends Partial<Asset> {
  [key: string]: any;
  _id: string; // Temp ID for React keys
  _rowNumber?: number; // Persistent database row number
  _version?: number; // Server optimistic-lock version
  syncStatus: 'draft' | 'synced'; // New field for dual-status
  _completed?: boolean;
  _missingFields?: string[];
}

export interface ProductionEntryTemplate {
  id: string;
  name: string;
  model?: string;
  fields: { key: string; label: string; required: boolean; fieldType?: string }[];
}

interface ProductionEntryProps {
  selectedTemplate?: ProductionEntryTemplate | null;
  initialQuantity?: number;
  permissions?: string[];
  scanTableId?: string;
  dispatchOrderNo?: string;
  disableAutoFillPartModels?: boolean;
  initialRows?: any[];
  onBatchCompleted?: () => void;
}

const isSnColumn = (field: { key: string; label: string; fieldType?: string }) => {
  if (String(field.fieldType || '').toUpperCase() === 'SN') return true;
  if (/型号|model/i.test(String(field.label || ''))) return false;
  return /sn|序列号|serial/i.test(`${field.key} ${field.label}`);
};

// Any non-SN custom column is a part/model descriptor column.  Custom columns
// are often named simply "网卡"、"主板" or "品牌" rather than ending in
// "型号"; they still need the first-row value propagation behaviour.  SN
// columns remain explicitly excluded so scanning one SN never copies it to
// other devices.
const isPartModelColumn = (field: { key: string; label: string }) =>
  !isSnColumn(field)
  && !field.label.includes('整机型号')
  && field.key.toLowerCase() !== 'model';

const snOperatorGroup = (fields: { key: string; label: string }[], index: number) => {
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    if (isPartModelColumn(fields[cursor])) return `model:${fields[cursor].key}`;
  }
  return `sn:${fields[index].key}`;
};

const isLastSnInOperatorGroup = (fields: { key: string; label: string }[], index: number) => {
  if (!isSnColumn(fields[index])) return false;
  const group = snOperatorGroup(fields, index);
  return !fields.slice(index + 1).some((field, offset) =>
    isSnColumn(field) && snOperatorGroup(fields, index + offset + 1) === group
  );
};

const TemplateGrid: React.FC<{
  rows: GridRow[];
  template: ProductionEntryTemplate;
  onChange: (id: string, field: string, value: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>, id: string, field?: string) => void;
  onDelete: (id: string) => void;
  onAddColumn: (afterIndex: number) => void;
  onDeleteColumn: (fieldKey: string, fieldLabel: string) => void;
  onComplete: (id: string) => void;
  canAddColumn: boolean;
  canDeleteColumn: boolean;
  canForceComplete: boolean;
  onBlur: (id: string, field: string, value: string) => void;
  dispatchOrderNo?: string;
}> = ({ rows, template, onChange, onKeyDown, onDelete, onAddColumn, onDeleteColumn, onComplete, canAddColumn, canDeleteColumn, canForceComplete, onBlur, dispatchOrderNo }) => (
  <div className="w-full overflow-x-auto pb-4">
    <table className="min-w-full divide-y divide-gray-200">
      <thead className="bg-cyan-50">
        <tr>
          <th className="sticky left-0 z-10 bg-cyan-50 px-3 py-3 text-center text-xs font-bold text-slate-600">序号</th>
          <th className="whitespace-nowrap px-3 py-3 text-left text-xs font-bold text-slate-600">派工单号</th>
          {template.fields.map((field, fieldIndex) => (
            <React.Fragment key={field.key}>
              <th className="whitespace-nowrap px-3 py-3 text-left text-xs font-bold text-slate-600">
                <span className="inline-flex items-center gap-1.5">{field.label}{field.required && <span className="text-red-500"> *</span>}<button disabled={!canAddColumn} onClick={() => onAddColumn(fieldIndex)} className={`grid h-5 w-5 place-items-center rounded-full text-sm font-bold leading-none text-white ${canAddColumn ? 'bg-cyan-700 hover:bg-cyan-800' : 'cursor-not-allowed bg-slate-300'}`} title={canAddColumn ? `在${field.label}右侧添加列` : '当前账号没有生产录入新增列权限'}>+</button><button disabled={!canDeleteColumn} onClick={() => onDeleteColumn(field.key, field.label)} className={`grid h-5 w-5 place-items-center rounded-full text-sm font-bold leading-none text-white ${canDeleteColumn ? 'bg-red-600 hover:bg-red-700' : 'cursor-not-allowed bg-slate-300'}`} title={canDeleteColumn ? `删除${field.label}列` : '当前账号没有删除扫码表列权限'}>−</button></span>
              </th>
              {isSnColumn(field) && <th className="whitespace-nowrap px-3 py-3 text-left text-xs font-bold text-cyan-700">操作员</th>}
            </React.Fragment>
          ))}
          <th className="px-3 py-3 text-center text-xs font-bold text-slate-600">操作</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-200 bg-white">
        {rows.filter(row => !row._completed).map((row, index) => (
          <tr key={row._id} className="hover:bg-cyan-50/30">
            <td className="sticky left-0 z-10 bg-white px-3 py-2 text-center text-xs text-slate-400">{index + 1}</td>
            <td className="whitespace-nowrap px-3 py-2 text-sm font-semibold text-slate-700">{dispatchOrderNo || '—'}</td>
            {template.fields.map((field, fieldIndex) => {
              const value = String(row[field.key] || '');
              // Keep one visible operator column beside every SN field. This
              // avoids hiding the power-SN operator when a template inserts a
              // model/custom field between two component groups.
              const showOperator = isSnColumn(field);
              const operatorGroup = snOperatorGroup(template.fields, fieldIndex);
              const groupOperator = showOperator
                ? template.fields
                    .map((candidate, candidateIndex) => ({ candidate, candidateIndex }))
                    .filter(({ candidate, candidateIndex }) => isSnColumn(candidate) && snOperatorGroup(template.fields, candidateIndex) === operatorGroup)
                    .map(({ candidate }) => row[`${candidate.key}_operator`])
                    .find(Boolean)
                : '';
              const displayedOperator = row[`${field.key}_operator`] || groupOperator;
              return <React.Fragment key={field.key}>
                <td className="min-w-[150px] p-1">
                  <input data-field={field.key} data-label={field.label} readOnly={Boolean(row._completed)} className={`scanner-input w-full rounded border-0 border-b-2 px-2 py-1.5 text-sm focus:border-cyan-600 focus:bg-white focus:ring-0 ${row._missingFields?.includes(field.key) ? 'border-red-500 bg-red-50 text-red-800 ring-2 ring-red-200' : 'border-transparent bg-transparent'} ${row._completed ? 'cursor-not-allowed bg-slate-50 font-semibold text-slate-600' : ''}`} value={value} placeholder={row._missingFields?.includes(field.key) ? `${field.label}未录入` : field.label} onKeyDown={e => onKeyDown(e, row._id, field.key)} onBlur={e => onBlur(row._id, field.key, e.target.value)} onChange={e => onChange(row._id, field.key, e.target.value)} />
                </td>
                {showOperator && <td className="min-w-[120px] bg-cyan-50/40 px-2 py-2 text-xs text-cyan-800">{displayedOperator || '—'}</td>}
              </React.Fragment>;
            })}
            <td className="whitespace-nowrap px-3 py-2 text-center">
              <button onClick={() => onComplete(row._id)} className={`rounded px-3 py-1.5 text-xs font-semibold text-white ${row._missingFields?.length ? (canForceComplete ? 'bg-amber-600 hover:bg-amber-700' : 'bg-red-500 hover:bg-red-600') : 'bg-emerald-600 hover:bg-emerald-700'}`}>{row._missingFields?.length ? (canForceComplete ? '强制完工' : '补齐后完工') : '完工'}</button>
              <button onClick={() => onDelete(row._id)} className="ml-2 text-xs text-red-500 hover:underline">删除</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
    {rows.length > 0 && rows.every(row => row._completed) && <div className="border-t border-emerald-100 bg-emerald-50 px-6 py-10 text-center text-sm font-semibold text-emerald-700">本批次设备已全部完工，待扫码列表已清零。</div>}
  </div>
);

const ProductionEntry: React.FC<ProductionEntryProps> = ({ selectedTemplate, initialQuantity, permissions, scanTableId, initialRows, dispatchOrderNo, disableAutoFillPartModels = false, onBatchCompleted }) => {
  const { user } = useAuth();
  const effectivePermissions = permissions || user?.permissions || [];
  const canAddColumn = effectivePermissions.includes('ADD_PRODUCTION_COLUMN');
  const canDeleteColumn = effectivePermissions.includes('DELETE_PRODUCTION_COLUMN');
  const canForceDuplicate = effectivePermissions.includes('FORCE_DUPLICATE_SN');
  const canForceComplete = effectivePermissions.includes('FORCE_COMPLETE_SCAN');
  const operatorNo = user ? `${user.username}${user.id ? ` (#${user.id})` : ''}` : '未登录';
  // -- State --
  const [batchName, setBatchName] = useState(generateBatchName());
  const [rows, setRows] = useState<GridRow[]>([
    { _id: '1', contract_no: '', model: '', machine_sn: '', syncStatus: 'draft' }
  ]);
  useEffect(() => {
    if (!initialRows?.length || !selectedTemplate) return;
    setRows(initialRows.map((source:any, index:number) => {
      // The backend is authoritative. Keep every persisted field key (including
      // custom keys such as field14_2) instead of reducing rows to Asset fields.
      const values = Object.fromEntries((source.values || []).flatMap((item:any) => {
        const key = item.fieldKey || item.field_key;
        const value = item.value ?? item.fieldValue ?? item.field_value ?? '';
        const operator = item.operatorNo || item.operator_no || '';
        return operator ? [[key, value], [`${key}_operator`, operator]] : [[key, value]];
      }));
      const modelField = (selectedTemplate.fields || []).find((field:any) =>
        !String(field.key).toLowerCase().includes('sn') &&
        /型号|model/i.test(String(field.label || field.key))
      );
      const modelValue = modelField ? values[modelField.key] : undefined;
      return {
        _id: String(source.id || index + 1),
        _rowNumber: Number(source.rowNumber || source.row_number || index + 1),
        _version: Number(source.version ?? 0),
        ...values,
        machine_sn: source.machineSn || values.machine_sn || '',
        model: modelValue || values.model || selectedTemplate.model || '',
        syncStatus: source.status === 'COMPLETED' ? 'synced' : 'draft',
        _completed: source.status === 'COMPLETED',
      };
    }));
  }, [initialRows, selectedTemplate]);
  const [activeTab, setActiveTab] = useState<'scan' | 'import'>('scan');
  
  // UX State
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [lastScanStatus, setLastScanStatus] = useState<'success' | 'error' | 'neutral'>('neutral');
  const [isSyncing, setIsSyncing] = useState(false);
  const [remoteAssets, setRemoteAssets] = useState<any[]>([]);
  const [lastSavedTime, setLastSavedTime] = useState<string>('');
  const [labelToPrint, setLabelToPrint] = useState<GridRow | null>(null);
  // Each scan-table session starts with the expected production flow:
  // machine SN -> next SN column. Do not inherit another operator's browser
  // preference from localStorage; the operator may still switch the mode for
  // the current session using the controls above the grid.
  const [scanJumpMode, setScanJumpMode] = useState<'horizontal' | 'vertical'>('horizontal');

  // Network State
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const audioContextRef = useRef<AudioContext | null>(null);
  const [machineSearch, setMachineSearch] = useState('');
  const draftBatchIdRef = useRef<number | null>(null);
  const draftBatchPromiseRef = useRef<Promise<number> | null>(null);
  const [runtimeFields, setRuntimeFields] = useState(selectedTemplate?.fields || []);
  const ensureDraftBatch = useCallback(async () => {
    if (draftBatchIdRef.current) return draftBatchIdRef.current;
    if (!draftBatchPromiseRef.current) {
      draftBatchPromiseRef.current = productionApi.createBatch(batchName)
        .then((batch: any) => {
          draftBatchIdRef.current = Number(batch.id);
          return Number(batch.id);
        })
        .finally(() => { draftBatchPromiseRef.current = null; });
    }
    return draftBatchPromiseRef.current;
  }, [batchName]);

  const persistDraftRow = useCallback(async (row: GridRow) => {
    // A persisted scan table owns its rows. Never replay those machine SNs
    // into the legacy production-batch draft API when merely opening it.
    if (scanTableId || !selectedTemplate || !row.machine_sn) return;
    const batchId = await ensureDraftBatch();
    await productionApi.saveDraftRow(batchId, {
      machineSn: row.machine_sn,
      model: row.model,
      contractNo: row.contract_no,
      ...(row.invoice_date ? { invoiceDate: row.invoice_date } : {}),
    });
    const componentRows = runtimeFields
      .filter(field => field.key.toLowerCase().includes('sn') && field.key !== 'machine_sn')
      .map(field => {
        const modelAliases: Record<string, string> = {
          cpu_sn: 'cpu_model',
          cpu_sn_2: 'cpu_model',
          mem_sns: 'mem_info',
          hdd_sn: 'hdd_info',
          psu_cage_sn: 'psu_info',
          psu_module_1_sn: 'psu_info',
          psu_module_2_sn: 'psu_info',
        };
        const modelKey = modelAliases[field.key] || field.key.replace(/_?sns?$/i, '_model');
        return {
          type: field.label.replace(/SN/ig, '').trim() || field.key,
          model: row[modelKey] || '',
          serialNo: row[field.key] || '',
        };
      });
    await productionApi.saveDraftComponents(batchId, row.machine_sn as string, componentRows);
    setLastSavedTime(new Date().toLocaleTimeString());
  }, [ensureDraftBatch, runtimeFields, selectedTemplate, scanTableId]);

  useEffect(() => {
    if (selectedTemplate) setRuntimeFields(selectedTemplate.fields.map(field => ({ ...field })));
  }, [selectedTemplate]);

  // When MES confirms a template and quantity, create the requested number of
  // draft rows. Existing rows are intentionally replaced only by this explicit
  // confirmation action (never while the operator is merely browsing templates).
  useEffect(() => {
    if (!selectedTemplate || !initialQuantity || initialQuantity < 1) return;
    // A persisted scan table row from the server must win over browser drafts.
    if (initialRows?.length) return;
    const quantity = Math.min(Math.floor(initialQuantity), 5000);
    const keyMap: Record<string, keyof Asset> = {
      machineSn: 'machine_sn', machine_sn: 'machine_sn',
      model: 'model', contractNo: 'contract_no', contract_no: 'contract_no', mbModel: 'mb_model', mb_model: 'mb_model', mbSn: 'mb_sn', mb_sn: 'mb_sn', cpuModel: 'cpu_model', cpu_model: 'cpu_model', cpuSn: 'cpu_sn', cpu_sn: 'cpu_sn', memModel: 'mem_info', mem_info: 'mem_info', memSn: 'mem_sns', mem_sns: 'mem_sns', hddModel: 'hdd_info', hdd_info: 'hdd_info', hddSn: 'hdd_sn', hdd_sn: 'hdd_sn', psuModel: 'psu_info', psu_info: 'psu_info', psuSn: 'psu_cage_sn', psu_cage_sn: 'psu_cage_sn',
    };
    const generated: GridRow[] = Array.from({ length: quantity }, (_, index) => {
      const templateModel = selectedTemplate.model || selectedTemplate.name;
      const row: GridRow = { _id: `${Date.now()}-${index}`, model: templateModel, syncStatus: 'draft' };
      selectedTemplate.fields.forEach(field => {
        const key = keyMap[field.key];
        if (key === 'model' || field.label.includes('整机型号')) row[field.key] = templateModel;
        else if (key) row[key] = '';
      });
      return row;
    });
    setRows(generated);
    setBatchName(`${selectedTemplate.name}_${generateBatchName()}`);
    setStatusMsg(null);
    setActiveTab('scan');
  }, [selectedTemplate, initialQuantity]);

  // Persist every scanned machine row shortly after its SN changes. The
  // server keeps the batch in DRAFT so multiple operators can see the latest
  // row without prematurely committing the batch.
  useEffect(() => {
    if (scanTableId || !selectedTemplate) return;
    const draftRows = rows.filter(row => row.machine_sn && !row._completed);
    if (!draftRows.length) return;
    const timer = window.setTimeout(async () => {
      try {
        await Promise.all(draftRows.map(persistDraftRow));
        setLastSavedTime(new Date().toLocaleTimeString());
        setStatusMsg({ type: 'success', text: '扫码数据已自动保存并同步到服务器。' });
      } catch (error: any) {
        setStatusMsg({ type: 'error', text: error?.message || '扫码数据服务器同步失败，请稍后重试。' });
      }
    }, 800);
    return () => window.clearTimeout(timer);
  }, [rows, selectedTemplate, persistDraftRow, scanTableId]);

  // -- Network Listener --
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    productionApi.listAssets().then(setRemoteAssets).catch(() => undefined);
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (audioContextRef.current) audioContextRef.current.close();
    };
  }, []);

  // -- Audio Feedback --
  const playFeedbackSound = (type: 'success' | 'error') => {
    if (!soundEnabled) return;
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      if (type === 'success') {
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(1000, ctx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
        oscillator.start();
        oscillator.stop(ctx.currentTime + 0.15);
      } else {
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(200, ctx.currentTime);
        oscillator.frequency.linearRampToValueAtTime(150, ctx.currentTime + 0.3);
        gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        oscillator.start();
        oscillator.stop(ctx.currentTime + 0.3);
      }
    } catch (e) { console.warn("Audio failed", e); }
  };

  // -- Handlers --

  const handleCellChange = (id: string, field: keyof Asset, value: string) => {
    setRows(prev => prev.map(r => {
      if (r._id === id) {
        // If editing a synced row, revert it to draft
        const newStatus = r.syncStatus === 'synced' ? 'draft' : r.syncStatus;
        const next: GridRow = { ...r, [field]: value, syncStatus: newStatus };
        const operatorFields: Record<string, string> = {
          machine_sn: 'machine_sn_operator', mb_sn: 'mb_sn_operator',
          cpu_sn: 'cpu_sn_operator', cpu_sn_2: 'cpu_sn_2_operator',
          psu_cage_sn: 'psu_cage_sn_operator', psu_module_1_sn: 'psu_module_1_sn_operator',
          psu_module_2_sn: 'psu_module_2_sn_operator', hdd_sn: 'hdd_sn_operator',
          mem_sns: 'mem_sns_operator', pcie_sn: 'pcie_sn_operator'
        };
        const metadata = runtimeFields.find(item => item.key === String(field));
        const isSnField = /sn|序列号/i.test(`${String(field)} ${metadata?.label || ''}`);
        const operatorKey = operatorFields[String(field)] || (isSnField ? `${String(field)}_operator` : '');
        if (operatorKey) next[operatorKey] = value.trim() ? operatorNo : '';
        return next;
      }
      return r;
    }));
  };

  const handleTemplateCellChange = (id: string, field: string, value: string) => {
    const metadata = runtimeFields.find(item => item.key === field);
    const isSn = /sn|序列号/i.test(`${field} ${metadata?.label || ''}`);
    const isPartModel = isPartModelColumn({ key: field, label: metadata?.label || field });
    const isFirstRow = rows[0]?._id === id;
    if (!disableAutoFillPartModels && isPartModel && isFirstRow) {
      setRows(previous => previous.map(row => ({ ...row, [field]: value })));
      return;
    }
    handleCellChange(id, field as keyof Asset, value);
  };

  const handleTemplateBlur = async (id: string, field: string, value: string) => {
    const metadata = runtimeFields.find(item => item.key === field);
    const isSnField = /sn|序列号/i.test(`${field} ${metadata?.label || ''}`);
    const isPartModel = isPartModelColumn({ key: field, label: metadata?.label || field });
    if (scanTableId && Number.isFinite(Number(scanTableId))) {
      const sourceIndex = rows.findIndex(item => item._id === id);
      if (sourceIndex >= 0) {
        const saveOne = async (row: GridRow, rowIndex: number, override?: string) => {
          const saved = await productionApi.saveScanRow(Number(scanTableId), row._rowNumber || rowIndex + 1, [{ fieldKey: field, value: override ?? String(row[field] || '') }], row._version);
          const persisted = (saved?.rows || []).find((candidate: any) => Number(candidate.rowNumber || candidate.row_number) === Number(row._rowNumber || rowIndex + 1));
          if (persisted?.version != null) setRows(previous => previous.map(item => item._id === row._id ? { ...item, _version: Number(persisted.version) } : item));
          return saved;
        };
        try {
          const firstRow = sourceIndex === 0 && !disableAutoFillPartModels && isPartModel;
          if (firstRow) {
            const propagated = String(value || '');
            await Promise.all(rows.map((row, rowIndex) => saveOne(row, rowIndex, propagated)));
          } else {
            await saveOne(rows[sourceIndex], sourceIndex, value);
          }
          setStatusMsg({ type: 'success', text: `${metadata?.label || field} 已自动保存并同步。` });
        } catch (error: any) {
          setStatusMsg({ type: 'error', text: error?.message || `${metadata?.label || field} 保存失败。` });
          return;
        }
      }
    }
    if (!isSnField) return;
    if (!value.trim()) {
      setStatusMsg({ type: 'success', text: `${metadata?.label || field} 已清空并同步，可重新扫码填写。` });
      return;
    }
    if (!canForceDuplicate) {
      const local = duplicateDetails(value, id);
      if (local) { setStatusMsg({ type: 'error', text: `SN ${value} 重复：设备 ${local}` }); return; }
      try {
        const currentRowIndex = rows.findIndex(item => item._id === id);
        const currentRow = currentRowIndex >= 0 ? rows[currentRowIndex] : undefined;
        const currentRowNumber = currentRow?._rowNumber || (currentRowIndex >= 0 ? currentRowIndex + 1 : undefined);
        const found = await productionApi.duplicateSn(value, scanTableId ? Number(scanTableId) : undefined, currentRowNumber);
        if (found.machineSn) {
          setRows(previous => previous.map(row => row._id === id ? { ...row, [field]: '' } : row));
          setStatusMsg({ type: 'error', text: `SN ${value} 重复：设备 ${found.machineSn} 的 ${found.component || '整机 SN'}` });
          return;
        }
      } catch { /* the save request below provides the authoritative error */ }
    }
    const row = rows.find(item => item._id === id);
    if (!row) return;
    try {
      await persistDraftRow({ ...row, [field]: value });
      setStatusMsg({ type: 'success', text: `SN ${value} 已自动保存，生产数据查询已同步。` });
    } catch (error: any) {
      setStatusMsg({ type: 'error', text: error?.message || `SN ${value} 保存失败，请重试。` });
    }
  };

  const insertRuntimeColumn = async (afterIndex: number) => {
    const label = window.prompt('请输入新增列名称，例如：网卡型号或网卡 SN')?.trim() || '';
    if (!label) return;
    const safe = label.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, '_');
    const type = label.toLowerCase().includes('sn') ? 'sn' : 'name';
    const key = `extra_${safe}_${type}_${Date.now()}`;
    try {
      if (scanTableId) await productionApi.addScanColumn(Number(scanTableId), key, label, runtimeFields[afterIndex]?.key || '');
    } catch (error: any) {
      setStatusMsg({ type: 'error', text: error?.message || '新增列同步失败。' });
      return;
    }
    setRuntimeFields(fields => {
      const next = [...fields];
      next.splice(afterIndex + 1, 0, { key, label, required: false });
      return next;
    });
  };
  const deleteRuntimeColumn = async (fieldKey: string, fieldLabel: string) => {
    if (!canDeleteColumn) return;
    if (fieldKey === 'model' || fieldLabel.includes('整机型号')) {
      setStatusMsg({ type: 'error', text: '整机型号为系统字段，不能删除。' });
      return;
    }
    if (!window.confirm(`确认删除“${fieldLabel}”列吗？该列已录入的数据也会一并删除。`)) return;
    try {
      if (scanTableId) await productionApi.deleteScanColumn(Number(scanTableId), fieldKey);
      setRuntimeFields(fields => fields.filter(field => field.key !== fieldKey));
      setRows(previous => previous.map(row => {
        const next = { ...row };
        delete next[fieldKey];
        delete next[`${fieldKey}_operator`];
        return next;
      }));
      setStatusMsg({ type: 'success', text: `“${fieldLabel}”列已删除并同步。` });
    } catch (error: any) {
      setStatusMsg({ type: 'error', text: error?.message || `“${fieldLabel}”列删除失败。` });
    }
  };
  const visibleRows = machineSearch.trim()
    ? rows.filter(row => String(row.machine_sn || '').toLowerCase().includes(machineSearch.trim().toLowerCase()))
    : rows;

  const completeRow = async (id: string) => {
    const row = rows.find(item => item._id === id);
    if (!row || !selectedTemplate) return;
    const missing = runtimeFields.filter(field => field.key.toLowerCase().includes('sn') && !String(row[field.key] || '').trim());
    if (missing.length && !canForceComplete) {
      setRows(previous => previous.map(item => item._id === id ? { ...item, _missingFields: missing.map(field => field.key) } : item));
      setStatusMsg({ type: 'error', text: `无法完工，缺少：${missing.map(field => field.label).join('、')}。请补齐标红字段后再完工。` });
      return;
    }
    if (missing.length && canForceComplete && !window.confirm(`该设备仍缺少：${missing.map(field => field.label).join('、')}。确认强制完工吗？`)) {
      setRows(previous => previous.map(item => item._id === id ? { ...item, _missingFields: missing.map(field => field.key) } : item));
      return;
    }
    const rowIndex = rows.findIndex(item => item._id === id);
    if (scanTableId && rowIndex >= 0) {
      try {
        // Persist completion on the server first. This makes the row hidden
        // for every account, not only in the current browser.
        await productionApi.completeScanRow(Number(scanTableId), row._rowNumber || rowIndex + 1, row._version);
      } catch (error: any) {
        setStatusMsg({ type: 'error', text: error?.message || '完工保存失败，请稍后重试。' });
        return;
      }
    }
    const remaining = rows.filter(item => item._id !== id && !item._completed).length;
    setRows(previous => previous.map(item => item._id === id ? { ...item, _completed: true, _missingFields: [] } : item));
    setStatusMsg({
      type: 'success',
      text: remaining === 0 ? '本批次所有设备已完工，待扫码表格已清零，可同步批次数据。' : `设备已完工并屏蔽，剩余 ${remaining} 台待扫码。`
    });
    if (remaining === 0) {
      onBatchCompleted?.();
    }
  };
  const checkDuplicate = (value: string, currentId: string): boolean => {
    if (!value || value.length < 4) return false;
    // 1. Check current batch
    const inCurrentBatch = rows.some(r => r._id !== currentId && Object.values(r).some(v => v === value));
    // 2. Check history
    const inHistory = remoteAssets.some(a => Object.values(a).some(v => v === value));
    return inCurrentBatch || inHistory;
  };

  const duplicateDetails = (value: string, currentId: string): string | null => {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return null;
    const fieldLabels: Record<string,string> = { machine_sn:'整机 SN',mb_sn:'主板 SN',cpu_sn:'CPU1 SN',cpu_sn_2:'CPU2 SN',psu_cage_sn:'电源 SN',psu_module_1_sn:'电源模块1 SN',psu_module_2_sn:'电源模块2 SN',hdd_sn:'硬盘 SN',mem_sns:'内存 SN',pcie_sn:'PCIE SN' };
    for (const row of rows) {
      if (row._id === currentId) continue;
      for (const [key, raw] of Object.entries(row)) {
        if (!key.toLowerCase().includes('sn') || key.endsWith('_operator')) continue;
        if (String(raw || '').trim().toLowerCase() === normalized) return `设备 ${row.machine_sn || `第 ${rows.indexOf(row)+1} 行`} 的 ${fieldLabels[key] || key}`;
      }
    }
    // Do not use the periodically refreshed asset cache for the blocking
    // decision: it can contain the same row currently being edited and would
    // produce a false duplicate warning. The backend duplicate endpoint is
    // authoritative for persisted records.
    return null;
  };

  const addNewRow = (autoFocus = false) => {
    const lastRow = rows[rows.length - 1];
    const newRow: GridRow = { 
      _id: Date.now().toString(),
      contract_no: lastRow?.contract_no || '',
      invoice_date: lastRow?.invoice_date || '',
      model: lastRow?.model || '',
      machine_sn: '',
      syncStatus: 'draft'
    };
    setRows(prev => [...prev, newRow]);
  };

  const deleteRow = (id: string) => {
    if (rows.length === 1) {
       setRows([{ _id: Date.now().toString(), contract_no: '', model: '', machine_sn: '', syncStatus: 'draft' }]);
       return;
    }
    setRows(rows.filter(r => r._id !== id));
  };

  const handlePrintLabel = (row: GridRow) => {
    if (!row.machine_sn) {
      setStatusMsg({ type: 'error', text: '无法打印：缺少 SN' });
      return;
    }
    setLabelToPrint(row);
    // Slight delay to allow DOM to render the printable area
    setTimeout(() => {
      window.print();
      // Optional: Clear label after print (or keep it, doesn't matter since it's hidden)
      // setLabelToPrint(null); 
    }, 100);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, id: string, field?: string) => {
    // Barcode scanners may terminate a scan with either Enter or Tab. Treat
    // both as the scan-complete event so every operator account follows the
    // same next-SN-column workflow.
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      const val = e.currentTarget.value.trim();
      
      const duplicate = duplicateDetails(val, id);
      if (duplicate && !canForceDuplicate) {
        playFeedbackSound('error');
        setLastScanStatus('error');
        setTimeout(() => setLastScanStatus('neutral'), 500);
        e.currentTarget.select();
        setStatusMsg({ type: 'error', text: `SN [${val}] 重复，已存在于${duplicate}。当前账号没有强制重复使用权限。` });
        return;
      }
      if (duplicate && canForceDuplicate && !window.confirm(`SN [${val}] 已存在于${duplicate}。确认以管理员权限强制重复使用吗？`)) { e.currentTarget.select(); return; }

      if (val.length > 0) {
        playFeedbackSound('success');
        setLastScanStatus('success');
        setTimeout(() => setLastScanStatus('neutral'), 300);
      }

      const isSnField = /sn|序列号|serial/i.test(`${field || ''} ${e.currentTarget.dataset.label || ''}`);
      if (isSnField) {
        if (scanJumpMode === 'vertical') {
          const sameFieldInputs = Array.from(document.querySelectorAll<HTMLInputElement>('.scanner-input[data-field]'))
            .filter(input => input.dataset.field === field && !input.readOnly && !input.disabled);
          const currentFieldIndex = sameFieldInputs.indexOf(e.currentTarget);
          if (currentFieldIndex >= 0 && currentFieldIndex < sameFieldInputs.length - 1) {
            sameFieldInputs[currentFieldIndex + 1].focus();
          }
          return;
        }
        const currentRow = e.currentTarget.closest('tr');
        const rowSnInputs = currentRow
          ? Array.from(currentRow.querySelectorAll<HTMLInputElement>('.scanner-input[data-field]'))
              .filter(input => /sn|序列号|serial/i.test(`${input.dataset.field || ''} ${input.dataset.label || ''}`) && !input.readOnly && !input.disabled)
          : [];
        const currentSnIndex = rowSnInputs.indexOf(e.currentTarget);
        if (currentSnIndex >= 0 && currentSnIndex < rowSnInputs.length - 1) {
          rowSnInputs[currentSnIndex + 1].focus();
          return;
        }

        const nextRow = currentRow?.nextElementSibling;
        const nextRowFirstSn = nextRow
          ? Array.from(nextRow.querySelectorAll<HTMLInputElement>('.scanner-input[data-field]'))
              .find(input => /sn|序列号|serial/i.test(`${input.dataset.field || ''} ${input.dataset.label || ''}`) && !input.readOnly && !input.disabled)
          : undefined;
        if (nextRowFirstSn) nextRowFirstSn.focus();
        return;
      }

      const inputs = Array.from(document.querySelectorAll('.scanner-input'));
      const currentIndex = inputs.indexOf(e.currentTarget);
      
      if (currentIndex !== -1 && currentIndex < inputs.length - 1) {
        (inputs[currentIndex + 1] as HTMLElement).focus();
      } else {
        addNewRow();
        playFeedbackSound('success');
        setTimeout(() => {
          const newInputs = Array.from(document.querySelectorAll('.scanner-input'));
          if (newInputs.length > currentIndex + 1) {
             (newInputs[currentIndex + 1] as HTMLElement).focus();
          }
        }, 100);
      }
    }
  };

  const handleSync = async () => {
    if (!isOnline) {
      setStatusMsg({ type: 'error', text: '当前处于离线状态，无法同步数据。数据已保存至本地。' });
      return;
    }

    const draftRows = rows.filter(r => r.syncStatus === 'draft' && r.machine_sn);
    if (draftRows.length === 0) {
      setStatusMsg({ type: 'info', text: '没有需要同步的草稿数据。' });
      return;
    }

    setIsSyncing(true);

    try {
      const batch = await productionApi.createBatch(batchName) as { id: number };
      const committedRows = draftRows.map(r => ({
        machineSn: r.machine_sn,
        contractNo: r.contract_no || undefined,
        model: r.model || undefined,
        invoiceDate: r.invoice_date || undefined
      }));
      await productionApi.commitBatch(batch.id, committedRows);
      setRows(prev => prev.map(r => r.syncStatus === 'draft' && r.machine_sn ? { ...r, syncStatus: 'synced' } : r));
      setStatusMsg({ type: 'success', text: `同步成功！已上传 ${draftRows.length} 条数据。` });
      setRemoteAssets(prev => [...committedRows, ...prev]);

    } catch (e) {
      setStatusMsg({ type: 'error', text: '同步失败，请检查网络连接。' });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      const file = files[0];
      
      // Limit to 1MB
      if (file.size > 1024 * 1024) {
        setStatusMsg({ type: 'error', text: "文件大小不能超过 1MB" });
        e.target.value = '';
        return;
      }

      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const XLSX = await import('xlsx');
          const wb = XLSX.read(evt.target?.result, { type: 'array' });
          const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
          
          if (!data || data.length === 0) {
             throw new Error("无数据");
          }

          const mappedRows: GridRow[] = data.map((d: any, idx: number) => ({
             _id: `imp_${idx}_${Date.now()}`,
             contract_no: d['合同号'] || '',
             invoice_date: d['发货日期'] || '',
             model: d['型号'] || '',
             machine_sn: d['SN'] || '', 
             mb_model: d['主板型号'] || '',
             mb_sn: d['SN_1'] || '', 
             cpu_model: d['CPU型号'] || '',
             cpu_sn: d['CPU序列号'] || '',
             cpu_sn_2: d['CPU序列号_1'] || '',
             psu_info: d['电源品牌、型号'] || '',
             psu_cage_sn: d['SN_2'] || '', 
             psu_module_1_sn: d['模块1'] || '',
             psu_module_2_sn: d['模块2'] || '',
             hdd_info: d['硬盘'] || '',
             hdd_sn: d['SN_3'] || '',
             mem_info: d['内存品牌、主频'] || '',
             mem_sns: ``, // Simplified
             pcie_sn: d['PCIE'] || '',
             syncStatus: 'draft' as const // Import as draft
          }));
          
          setRows(prev => [...prev.filter(r => r.machine_sn), ...mappedRows]);
          setActiveTab('scan');
          setStatusMsg({ type: 'success', text: `已导入 ${mappedRows.length} 条数据 (草稿)` });
        } catch (err: any) { 
           console.error(err);
           setStatusMsg({ type: 'error', text: `导入出错: ${err.message}` });
        }
      };
      reader.onerror = () => {
         setStatusMsg({ type: 'error', text: "文件读取失败" });
      };
      reader.readAsArrayBuffer(file);
      e.target.value = '';
    }
  };

  // Counters
  const pendingCount = rows.filter(r => r.syncStatus === 'draft' && r.machine_sn).length;
  const syncedCount = rows.filter(r => r.syncStatus === 'synced').length;

  return (
    <div className="space-y-6">
      {/* Hidden Label Template */}
      <div 
         className="printable-content fixed top-0 left-0 -z-50 opacity-0" 
         style={{ width: '100mm', height: '60mm', overflow: 'hidden', fontFamily: 'Arial, sans-serif' }}
      >
        {labelToPrint && (
           <div className="w-full h-full p-2 border-2 border-black flex flex-col justify-between box-border bg-white text-black">
              <div className="flex justify-between items-start">
                 <div>
                    <h1 className="text-xl font-bold tracking-tighter">SERVER TAG</h1>
                    <p className="text-xs font-bold mt-1">SN: <span className="text-lg font-mono">{labelToPrint.machine_sn}</span></p>
                    <p className="text-xs mt-1">Model: {labelToPrint.model}</p>
                 </div>
                 <div className="w-20 h-20 bg-white">
                    {/* Use a public QR code API for the label */}
                    <img 
                       src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${labelToPrint.machine_sn}`} 
                       alt="QR" 
                       className="w-full h-full object-contain" 
                    />
                 </div>
              </div>
              
              <div className="grid grid-cols-2 gap-1 text-[10px] leading-tight mt-2 border-t border-black pt-1">
                 <div>
                    <span className="font-bold">CPU:</span> {labelToPrint.cpu_model || 'N/A'}
                 </div>
                 <div>
                    <span className="font-bold">MEM:</span> {labelToPrint.mem_info ? 'Included' : '-'}
                 </div>
                 <div>
                    <span className="font-bold">HDD:</span> {labelToPrint.hdd_info ? 'Included' : '-'}
                 </div>
                 <div>
                    <span className="font-bold">Date:</span> {new Date().toLocaleDateString()}
                 </div>
              </div>

              <div className="text-[9px] text-center mt-auto font-bold uppercase tracking-widest">
                 TIGERWAY INNOVATION
              </div>
           </div>
        )}
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
             <ScanLine className="mr-2 text-blue-600" /> 生产录入系统
          </h1>
          <div className="flex items-center text-xs text-gray-500 mt-1 space-x-3">
             <span className="flex items-center">
               <Database className="w-3 h-3 mr-1" /> 本地缓存 (Atomic Save): 
               <span className="ml-1 font-mono text-gray-700">{lastSavedTime || 'Pending...'}</span>
             </span>
             <span className="flex items-center">
               {isOnline ? <Wifi className="w-3 h-3 mr-1 text-green-500"/> : <WifiOff className="w-3 h-3 mr-1 text-red-500"/>}
               {isOnline ? '网络在线' : '离线模式 (Offline)'}
             </span>
          </div>
        </div>
        
        <div className="flex space-x-3 items-center">
           <button 
             onClick={() => setSoundEnabled(!soundEnabled)}
             className={`p-2 rounded border transition-colors ${soundEnabled ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-gray-100 text-gray-400 border-gray-200'}`}
             title={soundEnabled ? "提示音: 开" : "提示音: 关"}
           >
             {soundEnabled ? <Volume2 size={20}/> : <VolumeX size={20}/>}
           </button>
           <div className="flex rounded-md shadow-sm">
             <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-sm">
               批次号
             </span>
             <input 
                type="text" 
                value={batchName}
                onChange={(e) => setBatchName(e.target.value)}
                className="flex-1 min-w-0 block w-48 px-3 py-2 rounded-none rounded-r-md border border-gray-300 sm:text-sm focus:ring-blue-500 focus:border-blue-500"
             />
           </div>
        </div>
      </div>

      {statusMsg && (
        <div className={`border px-4 py-3 rounded flex justify-between items-center animate-in slide-in-from-top-2 ${
           statusMsg.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' :
           statusMsg.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' :
           'bg-blue-50 border-blue-200 text-blue-800'
        }`}>
          <div className="flex items-center">
             {statusMsg.type === 'error' && <AlertCircle className="w-4 h-4 mr-2"/>}
             {statusMsg.type === 'success' && <Check className="w-4 h-4 mr-2"/>}
             <span>{statusMsg.text}</span>
          </div>
          <button onClick={() => setStatusMsg(null)} className="opacity-50 hover:opacity-100"><X className="w-4 h-4"/></button>
        </div>
      )}

      <div className={`bg-white rounded-lg shadow border transition-all duration-200 overflow-hidden ${lastScanStatus === 'error' ? 'ring-4 ring-red-300' : lastScanStatus === 'success' ? 'ring-4 ring-green-300' : 'border-gray-200'}`}>
         {/* Tabs */}
         <div className="flex border-b border-gray-200">
           <button onClick={() => setActiveTab('scan')} className={`flex-1 py-4 px-6 text-center font-medium text-sm ${activeTab === 'scan' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' : 'text-gray-500 hover:text-gray-700'}`}>扫码/网格录入</button>
           <button onClick={() => setActiveTab('import')} className={`flex-1 py-4 px-6 text-center font-medium text-sm ${activeTab === 'import' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' : 'text-gray-500 hover:text-gray-700'}`}>Excel 批量导入</button>
         </div>

         <div className="p-0">
           {activeTab === 'import' && (
             <div className="p-10 text-center">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 hover:bg-gray-50 transition-colors inline-block w-full max-w-2xl">
                  <FileSpreadsheet className="mx-auto h-12 w-12 text-gray-400" />
                  <label className="mt-4 block cursor-pointer">
                    <span className="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700 transition">选择 Excel 文件</span>
                    <input type="file" className="hidden" accept=".xlsx,.xls" onChange={handleExcelImport} />
                  </label>
                </div>
             </div>
           )}

           {activeTab === 'scan' && (
             <div className="overflow-x-auto relative">
               <div className="p-4 bg-blue-50/50 flex items-center justify-between border-b border-blue-100">
                  <div className="text-sm text-blue-800 flex items-center">
                     <span className="font-bold mr-2">操作指引:</span> 
                     <span className="bg-white border border-blue-200 px-2 py-0.5 rounded text-xs font-mono mr-1">Enter</span> 跳格 
                  </div>
                  <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">
                    <span className="text-blue-800">扫码后跳转：</span>
                    <label className="flex cursor-pointer items-center gap-1.5">
                      <input type="radio" name="scan-jump-mode" checked={scanJumpMode === 'horizontal'} onChange={() => { setScanJumpMode('horizontal'); localStorage.setItem('slss_scan_jump_mode', 'horizontal'); }} className="text-blue-600 focus:ring-blue-500" />
                      下一列 SN
                    </label>
                    <label className="flex cursor-pointer items-center gap-1.5">
                      <input type="radio" name="scan-jump-mode" checked={scanJumpMode === 'vertical'} onChange={() => { setScanJumpMode('vertical'); localStorage.setItem('slss_scan_jump_mode', 'vertical'); }} className="text-blue-600 focus:ring-blue-500" />
                      下一行同配件 SN
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input value={machineSearch} onChange={e => setMachineSearch(e.target.value)} placeholder="输入/扫描整机 SN 查询" className="w-56 rounded-md border border-blue-200 bg-white px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-400" />
                    {machineSearch && <button onClick={() => setMachineSearch('')} className="text-xs text-blue-700 hover:underline">显示全部</button>}
                  </div>
               </div>
               
               {selectedTemplate && (
                 <>
                     <TemplateGrid
                     rows={visibleRows}
                     template={{ ...selectedTemplate, fields: runtimeFields }}
                     onChange={handleTemplateCellChange}
                     onKeyDown={handleKeyDown}
                     onDelete={deleteRow}
                     onAddColumn={insertRuntimeColumn}
                     onDeleteColumn={deleteRuntimeColumn}
                     onComplete={completeRow}
                     canAddColumn={canAddColumn}
                     canDeleteColumn={canDeleteColumn}
                     canForceComplete={canForceComplete}
                     onBlur={handleTemplateBlur}
                     dispatchOrderNo={dispatchOrderNo}
                   />
                 </>
               )}
               <div className={`${selectedTemplate ? 'hidden' : ''} w-full overflow-x-scroll pb-4`}>
                 <table className="w-full divide-y divide-gray-200" style={{ minWidth: '2200px' }}>
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="sticky left-0 bg-gray-50 z-10 px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase w-10 border-r">No.</th>
                      <th className="sticky left-10 bg-gray-50 z-10 px-3 py-3 text-center text-xs font-bold text-gray-700 uppercase w-16 border-r shadow-sm">状态</th>
                      <th className="sticky left-28 bg-gray-50 z-10 px-3 py-3 text-left text-xs font-bold text-gray-700 uppercase w-40 bg-yellow-50 border-r shadow-sm">整机 SN</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase w-32">合同号</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase w-32">型号</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase w-32 bg-gray-50/50">主板型号</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase w-32 bg-gray-50/50">主板 SN</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-cyan-700 uppercase w-28">主板操作员</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase w-24">CPU型号</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase w-32">CPU1 SN</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-cyan-700 uppercase w-28">CPU操作员</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase w-32">CPU2 SN</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-cyan-700 uppercase w-28">CPU2操作员</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase w-32 bg-gray-50/50">电源信息</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase w-32 bg-gray-50/50">电源笼 SN</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-cyan-700 uppercase w-28">电源操作员</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase w-32 bg-gray-50/50">模块1 SN</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-cyan-700 uppercase w-28">模块1操作员</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase w-32 bg-gray-50/50">模块2 SN</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-cyan-700 uppercase w-28">模块2操作员</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase w-32">硬盘 SN</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-cyan-700 uppercase w-28">硬盘操作员</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase w-32">内存信息</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase w-48">内存 SN(s)</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-cyan-700 uppercase w-28">内存操作员</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase w-32 bg-purple-50">PCIE SN</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-cyan-700 uppercase w-28">PCIE操作员</th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase w-20 sticky right-0 bg-gray-50">操作</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {rows.map((row, idx) => (
                      <tr key={row._id} className="hover:bg-gray-50 group">
                        <td className="sticky left-0 bg-white z-10 px-3 py-2 text-xs text-gray-400 text-center border-r">{idx + 1}</td>
                        
                        {/* Status Column */}
                        <td className="sticky left-10 bg-white z-10 p-1 text-center border-r shadow-sm">
                           {row.syncStatus === 'synced' ? (
                              <div className="flex justify-center text-green-500" title="已同步 (Cloud)"><Cloud className="w-5 h-5 fill-current" /></div>
                           ) : (
                              row.machine_sn ? <div className="flex justify-center text-gray-400" title="本地草稿 (Draft)"><Check className="w-5 h-5" /></div> : <div className="w-5 h-5 rounded-full border border-gray-200 mx-auto"></div>
                           )}
                        </td>

                        <td className="sticky left-28 bg-white z-10 p-1 bg-yellow-50 border-r shadow-sm">
                           <input 
                            className={`scanner-input w-full border-0 border-b-2 border-transparent focus:border-blue-500 focus:ring-0 bg-transparent text-sm font-bold p-1 transition-colors focus:bg-white ${row.syncStatus === 'synced' ? 'text-green-700' : 'text-gray-900'}`}
                            value={row.machine_sn}
                            placeholder="SN..."
                            onKeyDown={(e) => handleKeyDown(e, row._id)}
                            onChange={e => handleCellChange(row._id, 'machine_sn', e.target.value)}
                          />
                        </td>
                        
                        {/* Fields */}
                        <td className="p-1"><input className="scanner-input w-full bg-transparent text-xs p-1 focus:bg-white" value={row.contract_no} onKeyDown={(e) => handleKeyDown(e, row._id)} onChange={e => handleCellChange(row._id, 'contract_no', e.target.value)} /></td>
                        <td className="p-1"><input className="scanner-input w-full bg-transparent text-xs p-1 focus:bg-white" value={row.model} onKeyDown={(e) => handleKeyDown(e, row._id)} onChange={e => handleCellChange(row._id, 'model', e.target.value)} /></td>
                        <td className="p-1 bg-gray-50/30"><input className="scanner-input w-full bg-transparent text-xs p-1 focus:bg-white" value={row.mb_model || ''} onKeyDown={(e) => handleKeyDown(e, row._id)} onChange={e => handleCellChange(row._id, 'mb_model', e.target.value)} /></td>
                        <td className="p-1 bg-gray-50/30"><input className="scanner-input w-full bg-transparent text-xs p-1 focus:bg-white" value={row.mb_sn || ''} onKeyDown={(e) => handleKeyDown(e, row._id)} onChange={e => handleCellChange(row._id, 'mb_sn', e.target.value)} /></td>
                        <td className="p-1 bg-cyan-50/40 text-xs text-cyan-800">{row.mb_sn_operator || '—'}</td>
                        <td className="p-1"><input className="scanner-input w-full bg-transparent text-xs p-1 focus:bg-white" value={row.cpu_model || ''} onKeyDown={(e) => handleKeyDown(e, row._id)} onChange={e => handleCellChange(row._id, 'cpu_model', e.target.value)} /></td>
                        <td className="p-1"><input className="scanner-input w-full bg-transparent text-xs p-1 focus:bg-white" value={row.cpu_sn || ''} onKeyDown={(e) => handleKeyDown(e, row._id)} onChange={e => handleCellChange(row._id, 'cpu_sn', e.target.value)} /></td>
                        <td className="p-1 bg-cyan-50/40 text-xs text-cyan-800">{row.cpu_sn_operator || '—'}</td>
                        <td className="p-1"><input className="scanner-input w-full bg-transparent text-xs p-1 focus:bg-white" value={row.cpu_sn_2 || ''} onKeyDown={(e) => handleKeyDown(e, row._id)} onChange={e => handleCellChange(row._id, 'cpu_sn_2', e.target.value)} /></td>
                        <td className="p-1 bg-cyan-50/40 text-xs text-cyan-800">{row.cpu_sn_2_operator || '—'}</td>
                        <td className="p-1 bg-gray-50/30"><input className="scanner-input w-full bg-transparent text-xs p-1 focus:bg-white" value={row.psu_info || ''} onKeyDown={(e) => handleKeyDown(e, row._id)} onChange={e => handleCellChange(row._id, 'psu_info', e.target.value)} /></td>
                        <td className="p-1 bg-gray-50/30"><input className="scanner-input w-full bg-transparent text-xs p-1 focus:bg-white" value={row.psu_cage_sn || ''} onKeyDown={(e) => handleKeyDown(e, row._id)} onChange={e => handleCellChange(row._id, 'psu_cage_sn', e.target.value)} /></td>
                        <td className="p-1 bg-cyan-50/40 text-xs text-cyan-800">{row.psu_cage_sn_operator || '—'}</td>
                        <td className="p-1 bg-gray-50/30"><input className="scanner-input w-full bg-transparent text-xs p-1 focus:bg-white" value={row.psu_module_1_sn || ''} onKeyDown={(e) => handleKeyDown(e, row._id)} onChange={e => handleCellChange(row._id, 'psu_module_1_sn', e.target.value)} /></td>
                        <td className="p-1 bg-cyan-50/40 text-xs text-cyan-800">{row.psu_module_1_sn_operator || '—'}</td>
                        <td className="p-1 bg-gray-50/30"><input className="scanner-input w-full bg-transparent text-xs p-1 focus:bg-white" value={row.psu_module_2_sn || ''} onKeyDown={(e) => handleKeyDown(e, row._id)} onChange={e => handleCellChange(row._id, 'psu_module_2_sn', e.target.value)} /></td>
                        <td className="p-1 bg-cyan-50/40 text-xs text-cyan-800">{row.psu_module_2_sn_operator || '—'}</td>
                        <td className="p-1"><input className="scanner-input w-full bg-transparent text-xs p-1 focus:bg-white" value={row.hdd_sn || ''} onKeyDown={(e) => handleKeyDown(e, row._id)} onChange={e => handleCellChange(row._id, 'hdd_sn', e.target.value)} /></td>
                        <td className="p-1 bg-cyan-50/40 text-xs text-cyan-800">{row.hdd_sn_operator || '—'}</td>
                        <td className="p-1"><input className="scanner-input w-full bg-transparent text-xs p-1 focus:bg-white" value={row.mem_info || ''} onKeyDown={(e) => handleKeyDown(e, row._id)} onChange={e => handleCellChange(row._id, 'mem_info', e.target.value)} /></td>
                        <td className="p-1"><input className="scanner-input w-full bg-transparent text-xs p-1 focus:bg-white" value={row.mem_sns || ''} onKeyDown={(e) => handleKeyDown(e, row._id)} onChange={e => handleCellChange(row._id, 'mem_sns', e.target.value)} /></td>
                        <td className="p-1 bg-cyan-50/40 text-xs text-cyan-800">{row.mem_sns_operator || '—'}</td>
                        <td className="p-1 bg-purple-50/30"><input className="scanner-input w-full bg-transparent text-xs p-1 font-medium text-purple-700 focus:bg-white" value={row.pcie_sn || ''} onKeyDown={(e) => handleKeyDown(e, row._id)} onChange={e => handleCellChange(row._id, 'pcie_sn', e.target.value)} /></td>
                        <td className="p-1 bg-cyan-50/40 text-xs text-cyan-800">{row.pcie_sn_operator || '—'}</td>

                        <td className="sticky right-0 bg-white z-10 px-3 py-2 text-center border-l flex space-x-1 justify-center">
                          {row.syncStatus === 'synced' && (
                             <button onClick={() => handlePrintLabel(row)} className="text-gray-300 hover:text-blue-600 p-1" title="打印标签">
                                <Printer className="w-4 h-4" />
                             </button>
                          )}
                          <button onClick={() => deleteRow(row._id)} className="text-gray-300 hover:text-red-500 p-1" title="删除行">
                             <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
               </div>
             </div>
           )}
         </div>

         <div className="bg-gray-50 p-4 border-t border-gray-200 flex justify-between items-center">
            <div className="text-xs text-gray-500 flex items-center space-x-4">
              <span className="flex items-center"><Check className="w-3 h-3 mr-1"/> 待同步: {pendingCount}</span>
              <span className="flex items-center text-green-600"><Cloud className="w-3 h-3 mr-1"/> 已同步: {syncedCount}</span>
            </div>
            <div className="flex space-x-3">
               <button onClick={() => addNewRow(true)} className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded shadow-sm hover:bg-gray-50 flex items-center text-sm font-medium">
                 <Plus className="w-4 h-4 mr-2" /> 新增一行
               </button>
               <div className={`flex items-center rounded px-4 py-2 text-sm font-semibold ${isOnline ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                 <Cloud className="mr-2 h-4 w-4" />{isOnline ? '自动保存与自动同步已启用' : '网络离线，本地自动保存中'}
               </div>
            </div>
         </div>
      </div>
    </div>
  );
};

export default ProductionEntry;
