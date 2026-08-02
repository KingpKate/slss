import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Plus, Save, ScanLine, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { productionApi } from '../services/apiClient';

type Field = { key: string; label: string; required: boolean };
type Template = { id: string; name: string; model?: string; description: string; symbology: string; active: boolean; fields: Field[] };

const defaultFields: Field[] = [
  { key: 'model', label: '整机型号', required: true }, { key: 'machine_sn', label: '整机 SN', required: true },
  { key: 'mb_model', label: '主板型号', required: true }, { key: 'mb_sn', label: '主板 SN', required: true },
  { key: 'cpu_model', label: 'CPU 型号', required: true }, { key: 'cpu_sn', label: 'CPU SN', required: true },
  { key: 'mem_info', label: '内存型号', required: true }, { key: 'mem_sns', label: '内存 SN', required: true },
  { key: 'hdd_info', label: '硬盘型号', required: true }, { key: 'hdd_sn', label: '硬盘 SN', required: true },
  { key: 'psu_info', label: '电源型号', required: true }, { key: 'psu_cage_sn', label: '电源 SN', required: true },
];

export default function ProductionScanTemplates() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [panel, setPanel] = useState<'create' | 'library'>('create');
  const [customer, setCustomer] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [templateError, setTemplateError] = useState('');
  useEffect(() => {
    const loadTemplates = () => productionApi.scanTemplates().then((items:any[]) => {
      setTemplates((items || []).map(item => ({
        id: String(item.id),
        name: item.customerName || item.customer_name || '',
        model: item.model || '',
        description: item.description || '',
        symbology: 'CODE_128',
        active: item.active !== false,
        fields: (item.fields || []).map((field:any) => ({
          key: field.fieldKey || field.field_key || field.key,
          label: field.fieldLabel || field.field_label || field.label,
          required: field.required ?? false,
        })),
      })));
    }).catch((error:any) => setTemplateError(error?.message || '模板库加载失败'));
    loadTemplates();
    const timer = window.setInterval(() => {
      if (!(document.activeElement instanceof HTMLInputElement) && !(document.activeElement instanceof HTMLTextAreaElement) && document.visibilityState === 'visible') loadTemplates();
    }, 2000);
    return () => window.clearInterval(timer);
  }, []);

  const customers = useMemo(() => Array.from(new Set(templates.map(template => template.name.trim()).filter(Boolean))).sort(), [templates]);
  const customerTemplates = selectedCustomer ? templates.filter(template => template.name.trim() === selectedCustomer) : [];
  const openLibraryTemplate = (template: Template) => {
    setSelectedTemplate(template);
    window.setTimeout(() => document.getElementById('scan-template-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  const createTemplate = () => {
    const name = customer.trim();
    if (!name) return;
    setTemplateError('');
    setSelectedTemplate({ id: `template-${Date.now()}`, name, model: '', description: '', symbology: 'QR_CODE', active: true, fields: defaultFields.map(field => ({ ...field })) });
  };
  const saveTemplate = async (template: Template) => {
    const normalizedCustomer = template.name.trim().toLowerCase();
    const normalizedModel = (template.model || '').trim().toLowerCase();
    if (!normalizedCustomer || !normalizedModel) { setTemplateError('客户名称和整机型号不能为空'); return; }
    const duplicate = templates.some(item => item.id !== template.id && item.name.trim().toLowerCase() === normalizedCustomer && (item.model || '').trim().toLowerCase() === normalizedModel);
    if (duplicate) { setTemplateError(`客户“${template.name.trim()}”已存在整机型号“${template.model?.trim()}”的扫码模板，不能重复创建`); return; }
    let saved = { ...template, name: template.name.trim(), model: template.model?.trim() };
    if (template.id.startsWith('template-')) {
      try {
        const created = await productionApi.createScanTemplate({
          customerName: saved.name,
          model: saved.model,
          description: saved.description,
          fields: saved.fields.map(field => ({ key: field.key, label: field.label, type: /sn/i.test(field.label) ? 'SN' : 'TEXT', required: field.required })),
        });
        saved = {
          ...saved,
          id: String(created.id),
          fields: (created.fields || []).map((field:any) => ({
            key: field.fieldKey || field.field_key,
            label: field.fieldLabel || field.field_label,
            required: field.required ?? false,
          })),
        };
      } catch (error:any) {
        setTemplateError(error?.message || '模板保存失败');
        return;
      }
    } else {
      try {
        const updated = await productionApi.updateScanTemplate(Number(template.id), {
          customerName: saved.name,
          model: saved.model,
          description: saved.description,
          fields: saved.fields.map(field => ({ key: field.key, label: field.label, type: /sn/i.test(field.label) ? 'SN' : 'TEXT', required: field.required })),
        });
        saved = { ...saved, fields: (updated.fields || []).map((field:any) => ({ key: field.fieldKey || field.field_key, label: field.fieldLabel || field.field_label, required: field.required ?? false })) };
      } catch (error:any) {
        setTemplateError(error?.message || '模板更新失败');
        return;
      }
    }
    setTemplates(previous => previous.some(item => item.id === saved.id) ? previous.map(item => item.id === saved.id ? saved : item) : [...previous, saved]);
    setTemplateError('');
    setSelectedTemplate(null);
    setPanel('library');
    setSelectedCustomer(saved.name);
  };
  const deleteTemplate = async (id: string) => {
    const target = templates.find(item => item.id === id);
    if (!target || !window.confirm(`确定删除“${target.name} / ${target.model || '未设置型号'}”模板吗？删除后模板将不再出现在模板库中。`)) return;
    setTemplateError('');
    try {
      if (!id.startsWith('template-')) await productionApi.deleteScanTemplate(Number(id));
      setTemplates(previous => previous.filter(item => item.id !== id));
      setSelectedTemplate(null);
      if (selectedCustomer && !templates.some(item => item.id !== id && item.name.trim() === selectedCustomer)) setSelectedCustomer(null);
    } catch (error: any) {
      setTemplateError(error?.message || '模板删除失败');
    }
  };

  return <div className="min-h-full bg-[var(--color-background)] p-4 md:p-7">
    <header style={{ background: 'linear-gradient(135deg, rgb(var(--slss-brand-rgb, 29, 80, 56)), rgb(var(--slss-brand-dark-rgb, 16, 42, 32)))' }} className="rounded-2xl px-6 py-7 text-white shadow-xl">
      <p className="text-xs font-bold uppercase tracking-[.28em] text-emerald-200">Production Scanner Control</p>
      <h1 className="mt-2 text-3xl font-semibold">生产扫码模板配置</h1>
      <p className="mt-2 text-sm text-slate-300">创建通用扫码模板，并按客户维护已保存的模板。</p>
    </header>
    <div className="mt-5 grid gap-3 md:grid-cols-2">
      <button onClick={() => { setPanel('create'); setSelectedTemplate(null); }} className={`rounded-xl border p-5 text-left transition ${panel === 'create' ? 'border-emerald-500 bg-emerald-50 shadow' : 'border-slate-200 bg-white hover:border-emerald-300'}`}><Plus className="text-emerald-700" /><h2 className="mt-3 font-bold text-slate-900">新建模板</h2><p className="mt-1 text-xs text-slate-500">创建客户的扫码字段和校验规则</p></button>
      <button onClick={() => { setPanel('library'); setSelectedTemplate(null); setSelectedCustomer(null); }} className={`rounded-xl border p-5 text-left transition ${panel === 'library' ? 'border-emerald-500 bg-emerald-50 shadow' : 'border-slate-200 bg-white hover:border-emerald-300'}`}><ScanLine className="text-emerald-700" /><h2 className="mt-3 font-bold text-slate-900">模板库</h2><p className="mt-1 text-xs text-slate-500">按客户查看和编辑已创建的全部扫码模板</p></button>
    </div>

    {panel === 'create' && <section className="mt-5 rounded-xl border bg-white p-6 shadow-sm">
      <h2 className="text-xl font-bold text-slate-900">新建模板</h2><p className="mt-1 text-sm text-slate-500">先输入客户名称，进入模板编辑器后保存。</p>
      {templateError && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{templateError}</div>}
      <div className="mt-5 flex max-w-xl gap-3"><input autoFocus value={customer} onChange={event => setCustomer(event.target.value)} placeholder="客户名称" className="flex-1 rounded-lg border px-3 py-2.5" /><button disabled={!customer.trim()} onClick={createTemplate} className="rounded-lg bg-cyan-700 px-5 py-2.5 font-semibold text-white disabled:bg-slate-300">进入模板编辑</button></div>
      {selectedTemplate && <div id="scan-template-editor" className="mt-6 scroll-mt-6"><Editor key={selectedTemplate.id} value={selectedTemplate} onSave={saveTemplate} onDelete={() => setSelectedTemplate(null)} /></div>}
    </section>}

    {panel === 'library' && <section className="mt-5 rounded-xl border bg-white p-6 shadow-sm">
      {templateError && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{templateError}</div>}
      {selectedCustomer ? <><button onClick={() => { setSelectedCustomer(null); setSelectedTemplate(null); }} className="mb-5 flex items-center gap-2 text-sm font-semibold text-cyan-700"><ArrowLeft size={16} />返回客户列表</button><h2 className="text-xl font-bold text-slate-900">{selectedCustomer} 的扫码模板</h2><div className="mt-5 grid gap-3 md:grid-cols-2">{customerTemplates.map(template => <button key={template.id} onClick={() => openLibraryTemplate(template)} className="rounded-lg border p-4 text-left hover:border-cyan-400 hover:bg-cyan-50"><div className="flex justify-between"><b>{template.model || '未设置整机型号'}</b><span className="text-xs text-emerald-600">{template.active ? '启用' : '停用'}</span></div><p className="mt-2 text-xs text-slate-500">{template.fields.length} 个字段 · {template.symbology}</p></button>)}</div>{selectedTemplate && <div id="scan-template-editor" className="mt-6 scroll-mt-6"><Editor key={selectedTemplate.id} value={selectedTemplate} onSave={saveTemplate} onDelete={() => deleteTemplate(selectedTemplate.id)} /></div>}</> : <><h2 className="text-xl font-bold text-slate-900">模板库 · 客户</h2><p className="mt-1 text-sm text-slate-500">点击客户名称查看该客户创建的全部扫码模板。</p><div className="mt-5 grid gap-3 md:grid-cols-3">{customers.map(name => <button key={name} onClick={() => setSelectedCustomer(name)} className="rounded-lg border p-5 text-left hover:border-cyan-400 hover:bg-cyan-50"><b>{name}</b><p className="mt-2 text-xs text-slate-500">{templates.filter(template => template.name.trim() === name).length} 个扫码模板</p></button>)}</div>{!customers.length && <div className="mt-5 rounded-lg border border-dashed p-10 text-center text-sm text-slate-500">暂无已创建模板，请进入“新建模板”。</div>}</>}
    </section>}
  </div>;
}

function Editor({ value, onSave, onDelete }: { value: Template; onSave: (template: Template) => void; onDelete: () => void }) {
  const [template, setTemplate] = useState(value);
  useEffect(() => setTemplate({ ...value, fields: value.fields.map(field => ({ ...field })) }), [value.id]);
  const update = (key: keyof Template, value: any) => setTemplate(previous => ({ ...previous, [key]: value }));
  const addFieldAfter = (index: number) => { const fields = [...template.fields]; fields.splice(index + 1, 0, { key: `field${fields.length + 1}`, label: '新字段型号 / SN', required: false }); update('fields', fields); };
  return <section className="rounded-xl border border-cyan-100 bg-cyan-50/40 p-6"><div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-cyan-700">Template Editor</p><h3 className="mt-1 text-xl font-semibold">扫码模板规则</h3></div><button onClick={() => update('active', !template.active)} className={template.active ? 'text-emerald-600' : 'text-slate-400'}>{template.active ? <ToggleRight size={30} /> : <ToggleLeft size={30} />}</button></div><div className="mt-5 grid gap-4 md:grid-cols-2"><label className="text-sm">客户名称<input value={template.name} onChange={event => update('name', event.target.value)} className="mt-1 w-full rounded-lg border p-2" /></label><label className="text-sm">整机型号<input value={template.model || ''} onChange={event => update('model', event.target.value)} className="mt-1 w-full rounded-lg border p-2" /></label><label className="text-sm">码制<select value={template.symbology} onChange={event => update('symbology', event.target.value)} className="mt-1 w-full rounded-lg border p-2"><option>QR_CODE</option><option>CODE_128</option><option>DATA_MATRIX</option></select></label><label className="text-sm md:col-span-2">说明<textarea value={template.description} onChange={event => update('description', event.target.value)} className="mt-1 w-full rounded-lg border p-2" /></label></div><div className="mt-6"><div className="flex justify-between"><h4 className="font-semibold">字段映射</h4></div><div className="mt-3 space-y-2">{template.fields.map((field, index) => <div key={index} className="grid grid-cols-[1fr_1fr_auto_auto] gap-2"><input value={field.key} onChange={event => { const fields = [...template.fields]; fields[index] = { ...field, key: event.target.value }; update('fields', fields); }} className="rounded border p-2 text-sm" /><input value={field.label} onChange={event => { const fields = [...template.fields]; fields[index] = { ...field, label: event.target.value }; update('fields', fields); }} className="rounded border p-2 text-sm" /><label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={field.required} onChange={event => { const fields = [...template.fields]; fields[index] = { ...field, required: event.target.checked }; update('fields', fields); }} />必填</label><button onClick={() => update('fields', template.fields.filter((_, fieldIndex) => fieldIndex !== index))} className="text-red-500"><Trash2 size={16} /></button><button type="button" onClick={() => addFieldAfter(index)} className="text-cyan-700" title="在此行下方添加一行"><Plus size={16} /></button></div>)}</div></div><div className="mt-7 flex justify-end gap-2 border-t pt-4"><button onClick={onDelete} className="rounded-lg border border-red-200 px-4 py-2 text-sm text-red-600">删除</button><button onClick={() => onSave(template)} className="flex items-center gap-2 rounded-lg bg-cyan-700 px-4 py-2 text-sm font-semibold text-white"><Save size={16} />保存模板</button></div></section>;
}
