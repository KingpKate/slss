
import React, { useState } from 'react';
import { Asset, LifecycleEvent } from '../types';
import { api, productionApi } from '../services/apiClient';
import { Search, Filter, Eye, Download, Server, CircuitBoard, HardDrive, Cpu, Zap, History, ArrowRight, GitCommit, Calendar, FileText } from 'lucide-react';

const ProductionList: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [selectedBatchName, setSelectedBatchName] = useState('');
  const [selectedBatchModel, setSelectedBatchModel] = useState('');
  const [selectedBatchKeys, setSelectedBatchKeys] = useState<string[]>([]);
  const [filterContract, setFilterContract] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [remoteLifecycle, setRemoteLifecycle] = useState<LifecycleEvent[]>([]);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(false);
  const [remoteScanTables, setRemoteScanTables] = useState<any[]>([]);

  React.useEffect(() => {
    setLoading(true); setLoadError('');
    Promise.all([productionApi.listAssets(), productionApi.scanTablesAll()])
      .then(([data, tables]) => {
        const known = new Set((data as any[]).map(asset => String(asset.machine_sn || '').toLowerCase()).filter(Boolean));
        const virtualAssets:any[] = [];
        const scanMetaByMachine = new Map<string, { createdAt?: string; batchName: string; model: string }>();
        (tables || []).forEach((table:any) => {
          const fields = table.template?.fields || [];
          (table.rows || []).forEach((row:any) => {
            const values = Object.fromEntries((row.values || []).map((value:any) => [value.fieldKey || value.field_key, value.value ?? value.fieldValue ?? '']));
            const valueItem = (key:string) => row.values?.find((value:any) => (value.fieldKey || value.field_key) === key);
            // Templates created before the standard field key was introduced
            // may use a custom key for the machine SN. Resolve it by label as
            // well, otherwise that batch cannot be opened from a search hit.
            const machineField = fields.find((field:any) =>
              field.fieldKey === 'machine_sn' || /整机\s*SN|整机序列号/i.test(String(field.fieldLabel || ''))
            );
            const machineKey = machineField?.fieldKey || 'machine_sn';
            const machineSn = String(values[machineKey] || '').trim();
            if (machineSn) scanMetaByMachine.set(machineSn.toLowerCase(), { createdAt: table.createdAt, batchName: `SCAN_TABLE_${table.id}`, model: table.model || values.model || '' });
            // Some historical completed rows were cancelled/closed before
            // the machine SN was entered, while component SNs were already
            // persisted. Keep such rows searchable by component SN instead
            // of dropping them solely because machineSn is blank.
            const virtualKey = machineSn ? machineSn.toLowerCase() : `scan_table_${table.id}_row_${row.rowNumber || row.row_number || ''}`;
            if (machineSn && known.has(machineSn.toLowerCase())) return;
            const components = fields
              .filter((field:any) => field.fieldKey !== machineKey && /sn|序列号/i.test(`${field.fieldKey} ${field.fieldLabel}`))
              .map((field:any, index:number) => {
                const serial = String(values[field.fieldKey] || '').trim();
                let model = '';
                for (let i = fields.findIndex((item:any) => item.fieldKey === field.fieldKey) - 1; i >= 0; i--) {
                  const candidate = fields[i];
                  if (/型号|model/i.test(`${candidate.fieldKey} ${candidate.fieldLabel}`)) { model = String(values[candidate.fieldKey] || ''); break; }
                }
                const item = valueItem(field.fieldKey);
                return { type: field.fieldLabel || field.fieldKey, model, serialNo: serial, operatorNo: item?.operatorNo || item?.operator_no || '' };
              }).filter((component:any) => component.serialNo);
            if (components.length || machineSn) {
              virtualAssets.push({ machine_sn: machineSn, model: table.model || values.model || '', batch_name: `SCAN_TABLE_${table.id}`, batchCreatedAt: table.createdAt, created_at: table.createdAt, components, _virtualKey: virtualKey });
              if (machineSn) known.add(machineSn.toLowerCase());
            }
          });
        });
        setRemoteScanTables(tables || []);
        const enrichedAssets = (data as Asset[]).map(asset => {
          const meta = scanMetaByMachine.get(String(asset.machine_sn || '').toLowerCase());
          return meta ? { ...asset, batchCreatedAt: (asset as any).batchCreatedAt || meta.createdAt, batch_name: asset.batch_name || meta.batchName, model: asset.model || meta.model } : asset;
        });
        setRemoteAssets([...enrichedAssets, ...(virtualAssets as Asset[])]);
      })
      .catch(err => { console.error('加载生产资产失败', err); setLoadError(err?.message || '生产资产接口暂时不可用'); })
      .finally(() => setLoading(false));
  }, []);
  const [remoteAssets, setRemoteAssets] = useState<Asset[]>([]);

  // Component SN searches must also resolve scan-only historical rows. Those
  // rows may not have a machine SN or legacy Asset record, so query the
  // authoritative repair lookup endpoint and merge its read-only projection
  // into the result set.
  React.useEffect(() => {
    const term = appliedSearch.trim();
    if (!term) return;
    productionApi.repairLookup(term).then((asset:any) => {
      if (!asset) return;
      setRemoteAssets(previous => {
        const key = `${asset.batch_name || asset.batchName || ''}|${asset.machine_sn || asset.machineSn || ''}|${term.toLowerCase()}`;
        const withoutDuplicate = previous.filter(item => `${(item as any).batch_name || ''}|${item.machine_sn || ''}|${term.toLowerCase()}` !== key);
        return [...withoutDuplicate, { ...asset, machine_sn: asset.machine_sn || asset.machineSn || '', batch_name: asset.batch_name || asset.batchName || '' } as Asset];
      });
    }).catch(() => undefined);
  }, [appliedSearch]);

  // Enhanced Filter Logic: Search within ALL component SNs
  const sourceAssets = remoteAssets;
  const filteredAssets = sourceAssets.filter(a => {
    const term = appliedSearch.toLowerCase().trim();
    
    // 1. Check specific filters
    const matchContract = !filterContract || (a.contract_no || '').toLowerCase().includes(filterContract.toLowerCase());
    const matchDate = !filterDate || (a.invoice_date || '').includes(filterDate);
    
    if (!matchContract || !matchDate) return false;

    // 2. Check Global Search Term
    if (!term) return true;

    // Aggregate all searchable fields into one string for easy checking
    const searchableFields = [
      a.machine_sn,
      a.contract_no,
      a.batch_name,
      a.model,
      a.mb_sn,
      a.cpu_sn,
      a.cpu_sn_2,
      a.psu_cage_sn,
      a.psu_module_1_sn,
      a.psu_module_2_sn,
      a.hdd_sn,
      a.mem_sns,
      a.pcie_sn
    ].map(val => (val || '').toLowerCase());
    const componentFields = ((a as any).components || []).flatMap((component:any) => [component.serialNo, component.model, component.type]).map((val:any) => String(val || '').toLowerCase());

    return [...searchableFields, ...componentFields].some(field => field.includes(term));
  });
  const batchResults = Array.from(
    new Map(
      filteredAssets.map(asset => [
        `${asset.batch_name || 'NO_BATCH'}::${asset.model || 'NO_MODEL'}`,
        {
          batchName: asset.batch_name || '',
          model: asset.model || '未设置型号',
          batchCreatedAt: (asset as any).batchCreatedAt,
          matchedMachineSn: asset.machine_sn,
        },
      ])
  ).values()
  );
  const batchKey = (result: { batchName?: string; model?: string }) => `${result.batchName || ''}::${result.model || ''}`;
  const selectedBatchAssets = sourceAssets.filter(asset => {
    if (selectedBatchName) return asset.batch_name === selectedBatchName;
    return Boolean(selectedBatchModel) && String(asset.model || '').trim() === selectedBatchModel;
  });
  const componentTypeKey = (value: unknown) => String(value || '').toLowerCase().replace(/sn|序列号|型号|[^a-z0-9\u4e00-\u9fff]/g, '');
  const selectedBatchComponentTypes = Array.from(new Map(
    selectedBatchAssets
      .flatMap(asset => ((asset as any).components || []).map((component: any) => String(component.type || '').trim()).filter(Boolean))
      .map(type => [componentTypeKey(type), type] as const)
      .filter(([key]) => key)
  ).values());
  const matchedSerial = (value: unknown) => Boolean(appliedSearch && String(value || '').trim().toLowerCase() === appliedSearch.trim().toLowerCase());
  const openBatch = (result: { batchName?: string; model?: string }) => {
    setSelectedBatchName(result.batchName || '');
    setSelectedBatchModel(result.model || '');
  };

  // Get Lifecycle history for the selected asset
  const getAssetHistory = (sn: string): LifecycleEvent[] => {
    return remoteLifecycle;
  };

  const openAsset = (asset: Asset) => {
    setSelectedAsset(asset);
    api.lifecycle(asset.machine_sn).then((events:any[]) => setRemoteLifecycle((events || []).map((event:any) => ({
      ...event,
      timestamp: event.timestamp || event.occurredAt || event.occurred_at,
      event_type: event.event_type || event.eventType,
      part_name: event.part_name || event.partName,
      old_sn: event.old_sn || event.oldSn,
      new_sn: event.new_sn || event.newSn,
      operator_no: event.operator_no || event.operatorNo,
    })) as LifecycleEvent[])).catch(err => setLoadError(err?.message || '生命周期加载失败'));
  };

  const exportBatchExcel = async (batchName: string) => {
    const batchAssets = sourceAssets.filter(asset => asset.batch_name === batchName);
    if (!batchAssets.length) {
      setLoadError('当前批次没有可导出的生产数据');
      return;
    }
    const templateTable = remoteScanTables.find((table:any) => (table.rows || []).some((row:any) => {
      const machine = (row.values || []).find((value:any) => (value.fieldKey || value.field_key) === 'machine_sn');
      return batchAssets.some(asset => String(asset.machine_sn || '').toLowerCase() === String(machine?.value || machine?.fieldValue || '').toLowerCase());
    }));
    const templateFields = templateTable?.template?.fields || [];
    const keyOf = (value:any) => String(value || '').toLowerCase().replace(/sn|序列号|型号|[^a-z0-9\u4e00-\u9fff]/g, '');
    const componentTypes = Array.from(new Set(batchAssets.flatMap(asset => ((asset as any).components || []).map((component: any) => String(component.type || '').trim()).filter(Boolean))));
    const assetsByMachine = new Map(batchAssets.map(asset => [String(asset.machine_sn || '').toLowerCase(), asset]));
    const templateRows = templateTable ? (templateTable.rows || []).filter((scanRow:any) => {
      const machine = (scanRow.values || []).find((value:any) => (value.fieldKey || value.field_key) === 'machine_sn');
      return assetsByMachine.has(String(machine?.value || machine?.fieldValue || '').toLowerCase());
    }) : [];
    // Keep the scan-table branch as an ordered matrix instead of an object keyed
    // by display label. A template is allowed to have repeated labels (for
    // example CPU SN / CPU SN and eight columns labelled 内存 SN); using an
    // object here silently overwrote all but the last repeated column.
    const rows = templateFields.length && templateRows.length ? templateRows.map((scanRow:any) => {
      const values = new Map<string, string>();
      (scanRow.values || []).forEach((value:any) => {
        const key = String(value.fieldKey || value.field_key || '').trim();
        if (key) values.set(key, String(value.value ?? value.fieldValue ?? ''));
      });
      const machineSn = String(values.get('machine_sn') || scanRow.machineSn || scanRow.machine_sn || '').trim();
      const asset:any = assetsByMachine.get(machineSn.toLowerCase());
      const components = asset?.components || [];
      return templateFields.map((field:any) => {
        const key = String(field.fieldKey || field.field_key || '').trim();
        const label = String(field.fieldLabel || field.field_label || key);
        // Raw scan values are authoritative. Only use the legacy asset
        // component projection when the field has no persisted scan value.
        const persisted = values.get(key);
        if (persisted !== undefined) return persisted;
        if (key === 'machine_sn' || /整机.*sn|machine.*sn/i.test(`${key} ${label}`)) return machineSn;
        if (/整机.*型号|^model$/i.test(`${key} ${label}`)) return String(asset?.model || '');
        const part = components.find((component:any) => keyOf(component.type) === keyOf(label));
        return /sn|序列号/i.test(`${key} ${label}`) ? String(part?.serialNo || '') : String(part?.model || '');
      });
    }) : batchAssets.map(asset => {
      const components = (asset as any).components || [];
      const row: Record<string, string> = templateFields.length ? {} : {
        '批次创建日期': (asset as any).batchCreatedAt ? new Date((asset as any).batchCreatedAt).toLocaleString() : '',
        '批次号': asset.batch_name || '',
        '整机型号': asset.model || '',
        '整机SN': asset.machine_sn || '',
      };
      const findPart = (pattern: RegExp) => components.find((component: any) => pattern.test(String(component.type || '')));
      const standardParts: Array<[string, RegExp]> = [
        ['主板', /主板|motherboard|main.?board/i],
        ['CPU', /cpu|处理器/i],
        ['内存', /内存|memory|ram/i],
        ['硬盘', /硬盘|hdd|ssd|storage/i],
        ['电源', /电源|psu|power/i],
      ];
      standardParts.forEach(([label, pattern]) => {
        const part = findPart(pattern);
        row[`${label}型号`] = part?.model || '';
        row[`${label}SN`] = part?.serialNo || '';
      });
      componentTypes.forEach(type => {
        const matching = components.filter((component: any) => String(component.type || '').trim() === type);
        row[`${type.replace(/SN|序列号/ig, '').trim()}型号`] = matching.map((component: any) => component.model || '').filter(Boolean).join(' / ');
        row[type] = matching.map((component: any) => component.serialNo || '').filter(Boolean).join(' / ');
      });
      return row;
    });
    const uniqueTemplateHeaders = (() => {
      const used = new Map<string, number>();
      return templateFields.map((field:any) => {
        const base = String(field.fieldLabel || field.field_label || field.fieldKey || field.field_key || '字段');
        const occurrence = (used.get(base) || 0) + 1;
        used.set(base, occurrence);
        // Keep the first label unchanged for compatibility, but make repeated
        // labels explicit in Excel so users can distinguish CPU2/memory DIMM
        // columns instead of seeing apparently duplicated headers.
        return occurrence === 1 ? base : `${base} ${occurrence}`;
      });
    })();
    const exportHeaders = templateFields.length && templateRows.length
      ? ['合同号', '发货日期', ...uniqueTemplateHeaders]
      : ['合同号', '发货日期', ...Object.keys(rows[0] || {})];
    const exportRows = templateFields.length && templateRows.length
      ? rows.map((row:any[]) => ['', '', ...row])
      : rows.map((row:any) => ['', '', ...exportHeaders.slice(2).map((header) => row[header] ?? '')]);
    const XLSX = await import('xlsx-js-style');
    // AoA preserves duplicate column labels and exact template ordering.
    const worksheet = XLSX.utils.aoa_to_sheet([exportHeaders, ...exportRows]);
    if (worksheet['!ref']) {
      const range = XLSX.utils.decode_range(worksheet['!ref']);
      for (let rowIndex = range.s.r; rowIndex <= range.e.r; rowIndex++) {
        for (let columnIndex = range.s.c; columnIndex <= range.e.c; columnIndex++) {
          const address = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex });
          const cell:any = worksheet[address];
          if (!cell || cell.v === undefined || cell.v === null || String(cell.v) === '') continue;
          cell.s = {
            ...(cell.s || {}),
            border: {
              top: { style: 'thin', color: { rgb: 'FFB7C3D0' } },
              bottom: { style: 'thin', color: { rgb: 'FFB7C3D0' } },
              left: { style: 'thin', color: { rgb: 'FFB7C3D0' } },
              right: { style: 'thin', color: { rgb: 'FFB7C3D0' } },
            },
          };
        }
      }
    }
    worksheet['!cols'] = exportHeaders.map((key) => ({ wch: key.includes('SN') || key.includes('序列号') ? 28 : 22 }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '批次扫码数据');
    const safeBatchName = batchName.replace(/[\\/:*?"<>|]/g, '_');
    XLSX.writeFile(workbook, `${safeBatchName}_生产扫码数据.xlsx`, { cellStyles: true });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center">
          <Server className="mr-2 text-blue-600" /> 生产数据查询 (ERP View)
        </h1>
      </div>

      <div className="bg-white rounded-lg shadow border border-gray-200">
        {loadError && <div className="m-4 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><span>{loadError}</span><button onClick={() => window.location.reload()} className="font-semibold underline">重试</button></div>}
        {loading && <div className="p-8 text-center text-sm text-gray-500">正在加载生产资产…</div>}
        {/* Toolbar */}
        <div className="p-4 border-b border-gray-200 bg-gray-50 flex flex-col xl:flex-row gap-4">
          
          {/* Global Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="全字段搜索: 机器SN, CPU/内存/硬盘/电源模块 SN..."
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && setAppliedSearch(searchTerm.trim())}
            />
          </div>
          <button onClick={() => setAppliedSearch(searchTerm.trim())} style={{ backgroundColor: 'rgb(var(--slss-brand-rgb, 29, 80, 56))' }} className="flex items-center justify-center rounded-md px-5 py-2 text-sm font-semibold text-white hover:brightness-110"><Search className="mr-2 h-4 w-4"/>查询</button>

          {/* Contract Filter */}
          <div className="relative w-full xl:w-64">
             <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
               <FileText className="h-4 w-4 text-gray-400" />
             </div>
             <input
               type="text"
               placeholder="筛选合同号..."
               className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
               value={filterContract}
               onChange={(e) => setFilterContract(e.target.value)}
             />
          </div>

          {/* Date Filter */}
          <div className="relative w-full xl:w-48">
             <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
               <Calendar className="h-4 w-4 text-gray-400" />
             </div>
             <input
               type="date"
               className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-600"
               value={filterDate}
               onChange={(e) => setFilterDate(e.target.value)}
             />
          </div>
          
          {/* Action Button */}
          <button 
             onClick={() => {setSearchTerm(''); setAppliedSearch(''); setFilterContract(''); setFilterDate('');}}
             className="flex items-center justify-center px-4 py-2 bg-white border border-gray-300 rounded text-sm text-gray-600 hover:bg-gray-50 whitespace-nowrap"
          >
             <Filter className="w-4 h-4 mr-2" /> 重置筛选
          </button>
        </div>

        {/* Data Grid */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider"><input type="checkbox" aria-label="全选查询批次" checked={batchResults.length > 0 && batchResults.every(result => selectedBatchKeys.includes(batchKey(result)))} onChange={event => setSelectedBatchKeys(event.target.checked ? batchResults.map(batchKey) : [])} /></th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">批次创建日期</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">整机型号</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">匹配整机 SN</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">批次号</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">完成时间</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">主要配置</th>
                <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {!appliedSearch ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    请输入整机 SN 或配件 SN，然后点击“查询”
                  </td>
                </tr>
              ) : batchResults.length > 0 ? (
                batchResults.map((result, idx) => (
                  <tr key={idx} className="hover:bg-emerald-50 transition-colors text-sm">
                    <td className="px-6 py-4 whitespace-nowrap"><input type="checkbox" aria-label={`选择批次 ${result.model}`} checked={selectedBatchKeys.includes(batchKey(result))} onChange={event => setSelectedBatchKeys(previous => event.target.checked ? [...new Set([...previous, batchKey(result)])] : previous.filter(key => key !== batchKey(result)))} /></td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-600">{result.batchCreatedAt ? new Date(result.batchCreatedAt).toLocaleString() : '—'}</td>
                    <td className="px-6 py-4 whitespace-nowrap"><button onClick={() => openBatch(result)} className="font-semibold text-blue-700 hover:underline">{result.model}</button></td>
                    <td className="px-6 py-4 whitespace-nowrap font-mono text-gray-700">{result.matchedMachineSn}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-500 text-xs">
                      {result.batchName || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-400">—</td>
                    <td className="px-6 py-4 text-gray-500 text-xs">点击整机型号查看该批次全部扫码数据</td>
                    <td className="px-6 py-4 whitespace-nowrap font-medium">
                      <div className="flex items-center justify-end gap-3">
                      <button 
                        onClick={() => openBatch(result)}
                        className="flex items-center text-blue-600 hover:text-blue-900"
                      >
                        <Eye className="w-4 h-4 mr-1" /> 查看批次
                      </button>
                      <button
                        onClick={() => exportBatchExcel(result.batchName)}
                        disabled={!selectedBatchKeys.includes(batchKey(result))}
                        title={selectedBatchKeys.includes(batchKey(result)) ? '导出已勾选批次' : '请先勾选该批次'}
                        className="flex items-center text-emerald-700 hover:text-emerald-900 disabled:cursor-not-allowed disabled:text-gray-300"
                      >
                        <Download className="mr-1 h-4 w-4" /> 导出 Excel
                      </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-gray-500 italic">
                    暂无数据，请尝试调整筛选条件
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Simple Pagination */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
           <span className="text-sm text-gray-700">
             显示 <span className="font-medium">{appliedSearch ? batchResults.length : 0}</span> 个批次，已勾选 <span className="font-medium text-emerald-700">{selectedBatchKeys.length}</span> 个
           </span>
           <div className="flex space-x-2">
             <button className="px-3 py-1 border rounded text-sm bg-white disabled:opacity-50" disabled>上一页</button>
             <button className="px-3 py-1 border rounded text-sm bg-white disabled:opacity-50" disabled>下一页</button>
           </div>
        </div>
      </div>

      {(selectedBatchName || selectedBatchModel) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[92vh] w-full max-w-7xl overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b bg-slate-50 px-6 py-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">批次扫码明细</h3>
                <p className="mt-1 text-sm text-slate-500">批次：{selectedBatchName} · 共 {selectedBatchAssets.length} 台整机</p>
              </div>
              <button onClick={() => { setSelectedBatchName(''); setSelectedBatchModel(''); }} className="text-2xl leading-none text-slate-400 hover:text-slate-700">&times;</button>
            </div>
            <div className="max-h-[76vh] overflow-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="sticky top-0 bg-slate-100 text-left text-xs font-bold text-slate-600">
                  <tr><th className="px-5 py-3">序号</th><th className="px-5 py-3">整机型号</th><th className="px-5 py-3">整机 SN</th>{selectedBatchComponentTypes.flatMap(type => [<th key={`${type}-model`} className="whitespace-nowrap px-5 py-3">{type.replace(/SN|序列号/ig, '').trim()}型号</th>,<th key={`${type}-sn`} className="whitespace-nowrap px-5 py-3">{type}</th>])}<th className="px-5 py-3">操作</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedBatchAssets.map((asset, index) => (
                    <tr key={asset.machine_sn} className="align-top hover:bg-emerald-50/40">
                      <td className="px-5 py-4 text-slate-500">{index + 1}</td>
                      <td className="px-5 py-4 font-semibold text-slate-800">{asset.model || '—'}</td>
                      <td className={`px-5 py-4 font-mono font-semibold ${matchedSerial(asset.machine_sn) ? 'bg-red-100 text-red-700 ring-2 ring-inset ring-red-400' : 'text-blue-700'}`}>{asset.machine_sn}</td>
                      {selectedBatchComponentTypes.flatMap(type => {
                        const matching = ((asset as any).components || []).filter((component:any) => componentTypeKey(component.type) === componentTypeKey(type));
                        return [
                          <td key={`${asset.machine_sn}-${type}-model`} className="whitespace-nowrap px-5 py-4 text-slate-700">{matching.map((component:any) => component.model).filter(Boolean).join(' / ') || '—'}</td>,
                          <td key={`${asset.machine_sn}-${type}-sn`} className={`whitespace-nowrap px-5 py-4 font-mono text-xs ${matching.some((component:any) => matchedSerial(component.serialNo)) ? 'bg-red-100 font-bold text-red-700' : 'text-cyan-800'}`}>{matching.map((component:any) => component.serialNo).filter(Boolean).join(' / ') || '—'}{matching.some((component:any) => component.operatorNo) && <span className="ml-2 font-sans text-xs text-slate-500">操作员：{matching.map((component:any) => component.operatorNo).filter(Boolean).join(' / ')}</span>}</td>
                        ];
                      })}
                      <td className="px-5 py-4"><button onClick={() => openAsset(asset)} className="whitespace-nowrap font-medium text-blue-600 hover:underline">设备详情</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedAsset && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl overflow-hidden animate-in fade-in zoom-in duration-200 max-h-[95vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50 sticky top-0 z-10">
              <h3 className="text-lg font-bold text-gray-900 flex items-center">
                 <Server className="w-5 h-5 mr-2 text-blue-600" /> 设备全生命周期档案
              </h3>
              <button onClick={() => setSelectedAsset(null)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
            </div>
            
            <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
               
               {/* Column 1: Basic Info */}
               <div className="lg:col-span-1 space-y-4">
                  <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-100">
                     <h4 className="text-xs font-bold text-blue-500 uppercase mb-3">基本信息</h4>
                     <div className="space-y-2 text-sm">
                       <div className="flex justify-between"><span className="text-gray-500">机器 SN:</span> <span className="font-mono font-bold text-blue-700">{selectedAsset.machine_sn}</span></div>
                       <div className="flex justify-between"><span className="text-gray-500">合同号:</span> <span>{selectedAsset.contract_no}</span></div>
                       <div className="flex justify-between"><span className="text-gray-500">型号:</span> <span>{selectedAsset.model}</span></div>
                       <div className="flex justify-between"><span className="text-gray-500">批次号:</span> <span>{selectedAsset.batch_name}</span></div>
                       <div className="flex justify-between"><span className="text-gray-500">完成时间:</span> <span>{selectedAsset.invoice_date}</span></div>
                       <div className="flex justify-between pt-2 border-t border-blue-200"><span className="text-gray-500">录入时间:</span> <span className="text-xs">{selectedAsset.created_at ? new Date(selectedAsset.created_at).toLocaleString() : '-'}</span></div>
                     </div>
                  </div>
                  
                  {/* Expansion */}
                  {selectedAsset.pcie_sn && (
                     <div className="bg-purple-50 p-4 rounded-lg border border-purple-100 shadow-sm">
                       <h4 className="text-xs font-bold text-purple-500 uppercase mb-3 flex items-center"><CircuitBoard className="w-4 h-4 mr-2"/> PCIE 扩展卡</h4>
                       <div className="text-sm font-mono text-gray-800 break-all">{selectedAsset.pcie_sn}</div>
                     </div>
                  )}
               </div>

               {/* Column 2 & 3: BOM Configuration + Lifecycle */}
               <div className="lg:col-span-2 space-y-6">
                  
                  {/* Current Configuration */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(selectedAsset as any).components?.length > 0 && (
                      <div className="md:col-span-2 overflow-hidden rounded-lg border border-cyan-200 bg-white">
                        <div className="border-b border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-900">整机流程单 · 全部设备配件 SN</div>
                        <table className="w-full text-sm">
                          <thead className="bg-slate-50 text-left text-xs text-slate-500"><tr><th className="px-4 py-2">配件</th><th className="px-4 py-2">型号</th><th className="px-4 py-2">SN</th><th className="px-4 py-2">操作员</th></tr></thead>
                          <tbody className="divide-y">{(selectedAsset as any).components.map((component:any,index:number)=><tr key={`${component.serialNo}-${index}`}><td className="px-4 py-2 font-medium">{component.type}</td><td className="px-4 py-2">{component.model || '—'}</td><td className="px-4 py-2 font-mono text-cyan-800">{component.serialNo}</td><td className="px-4 py-2 text-slate-500">{component.operatorNo || '—'}</td></tr>)}</tbody>
                        </table>
                      </div>
                    )}
                    {/* Motherboard & CPU */}
                    <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                      <h4 className="text-xs font-bold text-gray-400 uppercase mb-3 flex items-center"><CircuitBoard className="w-4 h-4 mr-2"/> 主板与处理器</h4>
                      <div className="space-y-4 text-sm">
                        <div>
                          <span className="block text-xs text-gray-500">主板 (Motherboard)</span>
                          <div className="font-medium">{selectedAsset.mb_model || 'Unknown'}</div>
                          <div className="text-xs font-mono text-gray-500 bg-gray-50 p-1 rounded inline-block border">{selectedAsset.mb_sn || 'N/A'}</div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                              <span className="block text-xs text-gray-500">CPU 1</span>
                              <div className="text-xs font-mono text-gray-600 truncate" title={selectedAsset.cpu_sn}>{selectedAsset.cpu_sn || 'N/A'}</div>
                            </div>
                            <div>
                              <span className="block text-xs text-gray-500">CPU 2</span>
                              <div className="text-xs font-mono text-gray-600 truncate" title={selectedAsset.cpu_sn_2}>{selectedAsset.cpu_sn_2 || 'N/A'}</div>
                            </div>
                        </div>
                      </div>
                    </div>

                    {/* Power Supply */}
                    <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                      <h4 className="text-xs font-bold text-gray-400 uppercase mb-3 flex items-center"><Zap className="w-4 h-4 mr-2"/> 电源系统</h4>
                      <div className="space-y-4 text-sm">
                        <div>
                          <span className="block text-xs text-gray-500">电源型号</span>
                          <div className="font-medium">{selectedAsset.psu_info || 'N/A'}</div>
                          <div className="text-xs font-mono text-gray-500 mt-1">笼子 SN: {selectedAsset.psu_cage_sn || 'N/A'}</div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 bg-emerald-50 p-2 rounded border border-emerald-100">
                            <div>
                              <span className="block text-xs text-yellow-700">模块 1</span>
                              <div className="text-xs font-mono text-gray-600 break-all">{selectedAsset.psu_module_1_sn || '-'}</div>
                            </div>
                            <div>
                              <span className="block text-xs text-yellow-700">模块 2</span>
                              <div className="text-xs font-mono text-gray-600 break-all">{selectedAsset.psu_module_2_sn || '-'}</div>
                            </div>
                        </div>
                      </div>
                    </div>

                    {/* Storage & Memory */}
                    <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm md:col-span-2">
                      <h4 className="text-xs font-bold text-gray-400 uppercase mb-3 flex items-center"><HardDrive className="w-4 h-4 mr-2"/> 存储与内存</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="block text-xs text-gray-500 mb-1">硬盘 (HDD/SSD)</span>
                          <div className="font-medium">{selectedAsset.hdd_info}</div>
                          <div className="text-xs font-mono text-gray-500 border p-1 rounded mt-1 bg-gray-50">{selectedAsset.hdd_sn || 'N/A'}</div>
                        </div>
                        <div>
                          <span className="block text-xs text-gray-500 mb-1">内存 (Memory)</span>
                          <div className="font-medium">{selectedAsset.mem_info}</div>
                          <div className="text-xs font-mono text-gray-500 border p-1 rounded mt-1 bg-gray-50 max-h-20 overflow-y-auto">
                            {selectedAsset.mem_sns ? selectedAsset.mem_sns.split(',').map((s, i) => (
                              <span key={i} className="block">{s.trim()}</span>
                            )) : 'N/A'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Lifecycle History Section */}
                  <div className="bg-gray-50 rounded-lg border border-gray-200 p-5">
                     <h4 className="text-sm font-bold text-gray-800 mb-4 flex items-center">
                        <History className="w-4 h-4 mr-2 text-blue-600" /> 配件更换与维修追溯 (Lifecycle Traceability)
                     </h4>
                     
                     <div className="relative border-l-2 border-gray-200 ml-3 space-y-6">
                        {getAssetHistory(selectedAsset.machine_sn).length > 0 ? (
                           getAssetHistory(selectedAsset.machine_sn).map((event, i) => (
                              <div key={i} className="ml-6 relative">
                                 <span className="absolute -left-[31px] top-0 flex h-6 w-6 items-center justify-center rounded-full bg-white ring-2 ring-blue-100">
                                    <GitCommit className="h-3 w-3 text-blue-500" />
                                 </span>
                                 <div>
                                    <div className="flex items-center text-sm font-medium text-gray-900">
                                       <span className="mr-2">{new Date(event.timestamp).toLocaleString()}</span>
                                       <span className={`px-2 py-0.5 rounded text-xs ${event.event_type === 'FACTORY_SHIP' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}`}>
                                          {event.event_type}
                                       </span>
                                    </div>
                                    <p className="text-sm text-gray-500 mt-1">{event.fault_description || event.faultDescription ? `故障描述：${event.fault_description || event.faultDescription} · ` : ''}{event.details}</p>
                                    {(event.operator_no || event.operatorNo || (event.details || '').includes('维修员')) && event.event_type === 'REPAIR_SWAP' && (
                                       <p className="mt-1 text-xs font-medium text-amber-700">维修操作员：{event.operator_no || event.operatorNo || String(event.details).split(/维修员[:：]/)[1]?.trim() || '—'}</p>
                                    )}
                                    
                                    {/* Swap Details */}
                                    {event.old_sn && (
                                       <div className="mt-2 bg-white border border-gray-200 rounded p-2 text-xs inline-block shadow-sm">
                                          <div className="font-bold text-gray-700 mb-1">{event.part_name || 'Component'} 更换:</div>
                                          <div className="flex items-center space-x-2 font-mono">
                                             <span className="font-semibold text-red-600 bg-red-50 px-1 rounded" title="旧 SN">{event.old_sn}</span>
                                             <ArrowRight className="w-3 h-3 text-gray-400" />
                                             <span className="text-green-600 bg-green-50 px-1 rounded" title="New SN">{event.new_sn}</span>
                                          </div>
                                       </div>
                                    )}
                                 </div>
                              </div>
                           ))
                        ) : (
                           <div className="ml-6 text-sm text-gray-400 italic">暂无维修更换记录</div>
                        )}
                        
                        {/* Initial State Marker */}
                        <div className="ml-6 relative">
                           <span className="absolute -left-[31px] top-0 flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 ring-2 ring-gray-50">
                              <div className="h-2 w-2 rounded-full bg-gray-400"></div>
                           </span>
                           <span className="text-xs text-gray-400">档案建立 (初始生产配置)</span>
                        </div>
                     </div>
                  </div>

               </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end">
              <button 
                onClick={() => setSelectedAsset(null)}
                className="px-4 py-2 bg-white border border-gray-300 rounded text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductionList;
