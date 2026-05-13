import React, { useState } from 'react';
import { Search, Hammer, ArrowRight, Save, AlertTriangle, CheckCircle, Cpu, User, ChevronRight } from 'lucide-react';
import { useAuth } from '../components/AuthContext';
import { FaultCategory, FAULT_CATEGORY_LABELS } from '../types';
import { FAULT_CATEGORY_COLORS } from '../constants';

// =============================================================================
// Types
// =============================================================================

interface ComponentSlot {
  component_type: string;
  component_label: string;
  index: number;
  sn: string;
  scanned_at?: string;
}

interface MachineData {
  id: number;
  machine_sn: string;
  contract_no?: string;
  scan_template_id?: string;
  hardware_data: Record<string, Array<{ sn: string; scanned_at?: string; model?: string }>>;
  scan_stage: string;
  created_at: string;
}

// =============================================================================
// Component type labels
// =============================================================================
const COMPONENT_LABELS: Record<string, string> = {
  cpu: 'CPU', mem: '内存', hdd: '硬盘', mb: '主板', psu: '电源',
  pcie: 'PCIe卡', gpu: 'GPU', nic: '网卡', raid: 'RAID卡', chassis: '机箱', other: '其他'
};

const COMPONENT_ICONS: Record<string, string> = {
  cpu: '🧠', mem: '📊', hdd: '💾', mb: '🔌', psu: '⚡',
  pcie: '🎴', gpu: '🎮', nic: '🌐', raid: '🗃️', chassis: '🖥️', other: '📦'
};

// =============================================================================
// ProductionRepair
// =============================================================================
const ProductionRepair: React.FC = () => {
  const { user } = useAuth();
  const [searchSn, setSearchSn] = useState('');
  const [loading, setLoading] = useState(false);
  const [machine, setMachine] = useState<MachineData | null>(null);
  const [components, setComponents] = useState<ComponentSlot[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  // Repair form
  const [newSn, setNewSn] = useState('');
  const [faultCategory, setFaultCategory] = useState('');
  const [faultMode, setFaultMode] = useState('');
  const [severity, setSeverity] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('MEDIUM');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // ---------------------------------------------------------------------------
  // Search machine SN → fetch hardware_data
  // ---------------------------------------------------------------------------
  const handleSearch = async () => {
    const sn = searchSn.trim();
    if (!sn) return;
    setLoading(true);
    setError('');
    setSuccess('');
    setMachine(null);
    setComponents([]);
    setSelectedIdx(null);

    try {
      const res = await fetch(`/api/production/scan-records?machine_sn=${encodeURIComponent(sn)}`);
      if (!res.ok) throw new Error('查询失败');
      const records: MachineData[] = await res.json();

      if (records.length === 0) {
        setError(`未找到机器 SN: ${sn} 的扫码记录`);
        return;
      }

      // Use the most recent record
      const record = records[0];
      setMachine(record);

      // Unpack hardware_data JSON into flat component list
      const flat: ComponentSlot[] = [];
      for (const [componentType, items] of Object.entries(record.hardware_data)) {
        items.forEach((item, idx) => {
          flat.push({
            component_type: componentType,
            component_label: COMPONENT_LABELS[componentType] || componentType,
            index: idx,
            sn: item.sn,
            scanned_at: item.scanned_at,
          });
        });
      }
      setComponents(flat);
    } catch (e: any) {
      setError(e.message || '查询失败');
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Select a component for repair
  // ---------------------------------------------------------------------------
  const handleSelectComponent = (idx: number) => {
    setSelectedIdx(idx);
    setNewSn('');
    setFaultCategory('');
    setFaultMode('');
    setSeverity('MEDIUM');
    setError('');
    setSuccess('');
  };

  // ---------------------------------------------------------------------------
  // Submit repair
  // ---------------------------------------------------------------------------
  const canSubmit = selectedIdx !== null && newSn.trim() && faultCategory;

  const handleSubmitRepair = async () => {
    if (!canSubmit || !machine) return;
    const comp = components[selectedIdx!];

    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      // 1. Create fault record
      const faultRes = await fetch('/api/production/fault-records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          machine_sn: machine.machine_sn,
          part_name: comp.component_label,
          part_sn: comp.sn,
          fault_category: faultCategory,
          fault_mode: faultMode || undefined,
          severity,
          operator_id: user?.id,
          operator_name: user?.username,
        })
      });
      if (!faultRes.ok) {
        const data = await faultRes.json();
        throw new Error(data.error || '故障记录提交失败');
      }

      // 2. Update scan record — replace old SN with new SN in hardware_data
      const updatedHardwareData = JSON.parse(JSON.stringify(machine.hardware_data));
      const arr = updatedHardwareData[comp.component_type];
      if (arr && arr[comp.index]) {
        arr[comp.index].sn = newSn;
        arr[comp.index].scanned_at = new Date().toISOString();
      }

      const updateRes = await fetch(`/api/production/scan-records/${machine.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hardware_data: updatedHardwareData })
      });
      if (!updateRes.ok) {
        const data = await updateRes.json();
        throw new Error(data.error || '扫码记录更新失败');
      }

      setSuccess(`维修完成：${comp.component_label} SN ${comp.sn} → ${newSn}`);

      // Update local state
      setMachine(prev => prev ? { ...prev, hardware_data: updatedHardwareData } : null);
      setComponents(prev => prev.map((c, i) =>
        i === selectedIdx ? { ...c, sn: newSn, scanned_at: new Date().toISOString() } : c
      ));
      setSelectedIdx(null);
      setNewSn('');
      setFaultCategory('');
      setFaultMode('');
    } catch (e: any) {
      setError(e.message || '提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Selected component
  // ---------------------------------------------------------------------------
  const selectedComp = selectedIdx !== null ? components[selectedIdx] : null;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Hammer className="text-orange-600" size={24} /> 生产维修系统
        </h1>
        {machine && (
          <span className="text-xs bg-blue-100 text-blue-800 px-3 py-1 rounded-full font-mono">
            {machine.machine_sn}
          </span>
        )}
      </div>

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex gap-4 items-end">
        <div className="flex-1">
          <label className="block text-xs text-gray-500 mb-1">扫描/输入 整机 SN</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              className="w-full pl-10 pr-4 py-2.5 border rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none"
              placeholder="输入整机序列号后回车查询"
              value={searchSn}
              onChange={e => setSearchSn(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              autoFocus
              data-testid="repair-search-input"
            />
          </div>
        </div>
        <button
          onClick={handleSearch}
          disabled={loading || !searchSn.trim()}
          className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm disabled:opacity-50"
          data-testid="repair-search-btn"
        >
          {loading ? '查询中...' : '查询'}
        </button>
      </div>

      {/* Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
          <AlertTriangle size={16} /> {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
          <CheckCircle size={16} /> {success}
        </div>
      )}

      {/* Main Workspace */}
      {machine && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Component List */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-4 border-b bg-gray-50 rounded-t-lg flex justify-between items-center">
              <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                <Cpu size={16} /> 配件清单 ({components.length} 项，点击选择维修)
              </h3>
              {machine.scan_template_id && (
                <span className="text-[10px] text-gray-400">模板: {machine.scan_template_id}</span>
              )}
            </div>
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              {components.map((comp, idx) => (
                <div
                  key={`${comp.component_type}-${idx}`}
                  onClick={() => handleSelectComponent(idx)}
                  className={`p-3 border rounded-lg cursor-pointer transition-all hover:shadow-md ${
                    selectedIdx === idx
                      ? 'border-orange-500 bg-orange-50 ring-1 ring-orange-500'
                      : 'border-gray-200 hover:border-blue-300'
                  }`}
                  data-testid={`component-card-${comp.component_type}-${comp.index}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-500 font-semibold flex items-center gap-1">
                      <span>{COMPONENT_ICONS[comp.component_type] || '📦'}</span>
                      {comp.component_label}
                      {comp.index > 0 && <span className="text-gray-400">#{comp.index + 1}</span>}
                    </span>
                    {selectedIdx === idx && <ChevronRight size={14} className="text-orange-500" />}
                  </div>
                  <div className="text-sm font-mono text-gray-800 break-all">
                    {comp.sn || <span className="text-gray-300 italic">Empty</span>}
                  </div>
                </div>
              ))}
              {components.length === 0 && (
                <div className="col-span-2 text-center text-gray-400 py-8 text-sm">
                  该机器暂无配件记录
                </div>
              )}
            </div>
          </div>

          {/* Right: Repair Action */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 h-fit">
            <div className="p-4 border-b bg-orange-50 rounded-t-lg">
              <h3 className="font-bold text-orange-800 text-sm">维修操作台</h3>
            </div>
            <div className="p-5 space-y-4">
              {!selectedComp ? (
                <div className="text-center text-gray-400 py-10">
                  <ArrowRight className="w-8 h-8 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">请在左侧点击需要更换的配件</p>
                </div>
              ) : (
                <>
                  {/* Selected component info */}
                  <div className="bg-orange-50 p-3 rounded-lg text-sm border border-orange-200">
                    <span className="text-orange-600 text-xs">正在维修:</span>
                    <span className="font-bold text-gray-900 ml-1">{selectedComp.component_label}</span>
                    {selectedComp.index > 0 && <span className="text-gray-500"> #{selectedComp.index + 1}</span>}
                  </div>

                  {/* Old SN (readonly) */}
                  <div>
                    <label className="block text-xs text-gray-500 mb-1 font-semibold">原条码 (Old SN)</label>
                    <input
                      className="w-full border bg-gray-100 text-gray-500 rounded-lg p-2 text-sm font-mono"
                      value={selectedComp.sn}
                      disabled
                      data-testid="repair-old-sn"
                    />
                  </div>

                  {/* New SN */}
                  <div>
                    <label className="block text-xs text-gray-500 mb-1 font-semibold">
                      新条码 (New SN) <span className="text-red-500">*</span>
                    </label>
                    <input
                      className="w-full border border-blue-400 rounded-lg p-2 text-sm font-mono focus:ring-2 focus:ring-blue-200 outline-none"
                      placeholder="扫描新 SN"
                      value={newSn}
                      onChange={e => setNewSn(e.target.value)}
                      autoFocus
                      data-testid="repair-new-sn"
                    />
                  </div>

                  {/* FMEA Fault Category */}
                  <div>
                    <label className="block text-xs text-gray-500 mb-1 font-semibold">
                      故障类别 (FMEA) <span className="text-red-500">*</span>
                    </label>
                    <select
                      className="w-full border rounded-lg p-2 text-sm"
                      value={faultCategory}
                      onChange={e => setFaultCategory(e.target.value)}
                      data-testid="repair-fault-category"
                    >
                      <option value="">-- 必选 --</option>
                      {Object.entries(FAULT_CATEGORY_LABELS).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                    {faultCategory && (
                      <span className={`inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full ${FAULT_CATEGORY_COLORS[faultCategory] || 'bg-gray-100 text-gray-800'}`}>
                        {FAULT_CATEGORY_LABELS[faultCategory]}
                      </span>
                    )}
                  </div>

                  {/* Fault Mode (optional) */}
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">故障现象描述</label>
                    <input
                      className="w-full border rounded-lg p-2 text-sm"
                      placeholder="可选，如: 开机无显示"
                      value={faultMode}
                      onChange={e => setFaultMode(e.target.value)}
                      data-testid="repair-fault-mode"
                    />
                  </div>

                  {/* Severity */}
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">严重程度</label>
                    <div className="flex gap-2">
                      {(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const).map(s => (
                        <button
                          key={s}
                          onClick={() => setSeverity(s)}
                          className={`flex-1 py-1.5 text-xs rounded-lg border transition-colors ${
                            severity === s
                              ? s === 'CRITICAL' ? 'bg-red-600 text-white border-red-600' :
                                s === 'HIGH' ? 'bg-orange-500 text-white border-orange-500' :
                                s === 'MEDIUM' ? 'bg-yellow-500 text-white border-yellow-500' :
                                'bg-green-500 text-white border-green-500'
                              : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          {s === 'LOW' ? '低' : s === 'MEDIUM' ? '中' : s === 'HIGH' ? '高' : '严重'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Submit */}
                  <button
                    onClick={handleSubmitRepair}
                    disabled={!canSubmit || submitting}
                    className="w-full py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-bold text-sm shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    data-testid="repair-submit-btn"
                  >
                    <Save size={16} />
                    {submitting ? '提交中...' : '提交维修记录'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductionRepair;
