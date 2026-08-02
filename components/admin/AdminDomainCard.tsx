import React from 'react';
import { ArrowUpRight, LucideIcon } from 'lucide-react';

type Props = { title: string; description: string; icon: LucideIcon; value?: string | number; onOpen?: () => void };

/** Consistent domain entry point used by the administration control center. */
export const AdminDomainCard: React.FC<Props> = ({ title, description, icon: Icon, value, onOpen }) => (
  <button type="button" onClick={onOpen} className="group rounded-xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--theme-primary-border)] hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[var(--theme-primary)] focus:ring-offset-2">
    <div className="flex items-start justify-between gap-3"><span className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--theme-primary-soft)] text-[var(--theme-primary-strong)]"><Icon className="h-4 w-4" /></span><ArrowUpRight className="h-4 w-4 text-slate-300 transition group-hover:text-[var(--theme-primary)]" /></div>
    <div className="mt-4 flex items-end justify-between gap-2"><div><p className="text-sm font-semibold text-slate-900">{title}</p><p className="mt-1 text-xs leading-5 text-slate-500">{description}</p></div>{value !== undefined && <span className="text-lg font-semibold text-slate-900">{value}</span>}</div>
  </button>
);

export default AdminDomainCard;
