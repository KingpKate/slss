import React from 'react';
import { Activity, Wrench } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const palette = ['var(--theme-primary-strong)', 'var(--theme-primary)', 'var(--status-good)', 'var(--status-warning)', 'var(--status-error)', '#7c3aed'];

const DashboardCharts: React.FC<{ customers: any[]; components: any[] }> = ({ customers, components }) => (
  <section className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
    <article className="slss-card min-w-0 p-5">
      <div className="mb-4 flex items-start justify-between"><div><h2 className="slss-section-title text-lg font-bold">客户交付进度</h2><p className="mt-1 text-xs text-slate-500">完工、未完工与维修设备按客户汇总</p></div><Activity className="text-[var(--color-secondary)]" size={20} /></div>
      <div className="h-[280px] min-w-0">{customers.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={customers} margin={{ top: 8, right: 10, left: -18, bottom: 8 }}><CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" /><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} /><Tooltip /><Legend /><Bar dataKey="完工" fill="var(--status-good)" radius={[4, 4, 0, 0]} /><Bar dataKey="未完工" fill="var(--status-warning)" radius={[4, 4, 0, 0]} /><Bar dataKey="维修" fill="var(--status-error)" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer> : <div className="grid h-full place-items-center text-sm text-slate-500">暂无生产统计数据</div>}</div>
    </article>
    <article className="slss-card min-w-0 p-5">
      <div className="mb-4 flex items-start justify-between"><div><h2 className="slss-section-title text-lg font-bold">故障组件分布</h2><p className="mt-1 text-xs text-slate-500">维修事件按组件类型统计</p></div><Wrench className="text-[var(--status-error)]" size={20} /></div>
      <div className="h-[280px] min-w-0">{components.length ? <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={components} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={92} label={({ name, percent }) => `${name} ${Math.round((percent || 0) * 100)}%`}>{components.map((_: any, index: number) => <Cell key={index} fill={palette[index % palette.length]} />)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer> : <div className="grid h-full place-items-center text-sm text-slate-500">暂无维修组件数据</div>}</div>
    </article>
  </section>
);

export default DashboardCharts;
