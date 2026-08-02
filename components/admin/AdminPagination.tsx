import React from 'react';

/** Shared pagination control for all admin list DTOs. */
export type AdminPage<T = unknown> = {
  content?: T[];
  number?: number;
  page?: number;
  totalPages?: number;
  totalElements?: number;
};

type Props = {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  label?: string;
  disabled?: boolean;
};

export const AdminPagination: React.FC<Props> = ({ page, totalPages, onPageChange, label = '记录', disabled = false }) => {
  const pages = Math.max(totalPages || 0, 1);
  return (
    <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3 text-xs text-slate-500" aria-label={`${label}分页`}>
      <span>第 {Math.min(page + 1, pages)} / {pages} 页</span>
      <div className="flex items-center gap-2">
        <button type="button" disabled={disabled || page <= 0} onClick={() => onPageChange(page - 1)} className="rounded-md border border-slate-200 bg-white px-3 py-1.5 transition hover:border-[var(--theme-primary-border)] disabled:cursor-not-allowed disabled:opacity-40">上一页</button>
        <button type="button" disabled={disabled || page + 1 >= pages} onClick={() => onPageChange(page + 1)} className="rounded-md border border-slate-200 bg-white px-3 py-1.5 transition hover:border-[var(--theme-primary-border)] disabled:cursor-not-allowed disabled:opacity-40">下一页</button>
      </div>
    </div>
  );
};

export default AdminPagination;
