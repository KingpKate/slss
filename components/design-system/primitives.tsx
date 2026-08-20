import React from 'react';
import { AlertTriangle, CheckCircle2, Info, Loader2, X } from 'lucide-react';

export const PageContainer = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className = '', ...props }, ref) => (
  <div ref={ref} className={`ds-page-container ${className}`} {...props} />
));
PageContainer.displayName = 'PageContainer';

export const PageHeader: React.FC<{ title: string; subtitle?: string; eyebrow?: string; actions?: React.ReactNode }> = ({ title, subtitle, eyebrow, actions }) => (
  <header className="ds-page-header">
    <div className="min-w-0">
      {eyebrow && <p className="ds-eyebrow">{eyebrow}</p>}
      <h1 className="ds-page-title">{title}</h1>
      {subtitle && <p className="ds-page-subtitle">{subtitle}</p>}
    </div>
    {actions && <div className="ds-page-actions">{actions}</div>}
  </header>
);

export const ContentSection: React.FC<React.HTMLAttributes<HTMLElement> & { title?: string; description?: string; actions?: React.ReactNode }> = ({ title, description, actions, className = '', children, ...props }) => (
  <section className={`ds-section ${className}`} {...props}>
    {(title || description || actions) && <div className="ds-section-header"><div>{title && <h2 className="ds-section-title">{title}</h2>}{description && <p className="ds-section-description">{description}</p>}</div>{actions}</div>}
    {children}
  </section>
);

export const FilterBar: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className = '', ...props }) => (
  <div className={`ds-filter-bar ${className}`} {...props} />
);

export interface DataColumn<T> {
  key: string;
  header: React.ReactNode;
  render?: (row: T, index: number) => React.ReactNode;
  className?: string;
}

export const DataTable = <T,>({
  columns,
  rows,
  rowKey,
  emptyLabel = '暂无数据',
  className = '',
}: {
  columns: DataColumn<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string | number;
  emptyLabel?: string;
  className?: string;
}) => (
  <div className="ds-table-frame">
    <table className={`ds-table ${className}`}>
      <thead><tr>{columns.map(column => <th key={column.key} className={column.className}>{column.header}</th>)}</tr></thead>
      <tbody>
        {rows.map((row, index) => <tr key={rowKey(row, index)}>{columns.map(column => <td key={column.key} className={column.className}>{column.render ? column.render(row, index) : String((row as Record<string, unknown>)[column.key] ?? '—')}</td>)}</tr>)}
      </tbody>
    </table>
    {!rows.length && <div className="ds-table-empty">{emptyLabel}</div>}
  </div>
);

export const FormField: React.FC<{ label: string; htmlFor?: string; hint?: string; error?: string; children: React.ReactNode }> = ({ label, htmlFor, hint, error, children }) => (
  <div className="ds-form-field">
    <label className="ds-form-label" htmlFor={htmlFor}>{label}</label>
    {children}
    {error ? <p className="ds-form-error" role="alert">{error}</p> : hint ? <p className="ds-form-hint">{hint}</p> : null}
  </div>
);

export const LoadingState: React.FC<{ label?: string }> = ({ label = '正在加载…' }) => <div className="ds-state" role="status"><Loader2 className="ds-state-icon animate-spin" aria-hidden="true" /><span>{label}</span></div>;
export const EmptyState: React.FC<{ title?: string; description?: string }> = ({ title = '暂无数据', description }) => <div className="ds-state" role="status"><Info className="ds-state-icon" aria-hidden="true" /><strong>{title}</strong>{description && <span>{description}</span>}</div>;

export const ErrorState: React.FC<{ title?: string; message: string; onRetry?: () => void }> = ({ title = '数据加载失败', message, onRetry }) => <div className="ds-state ds-state-error" role="alert"><AlertTriangle className="ds-state-icon" aria-hidden="true" /><strong>{title}</strong><span>{message}</span>{onRetry && <button type="button" className="ds-button ds-button-secondary" onClick={onRetry}>重试</button>}</div>;

export const Toast: React.FC<{ type: 'success' | 'error' | 'info'; message: string; onClose?: () => void }> = ({ type, message, onClose }) => { const Icon = type === 'success' ? CheckCircle2 : type === 'error' ? AlertTriangle : Info; return <div className={`ds-toast ds-toast-${type}`} role={type === 'error' ? 'alert' : 'status'}><Icon size={16} aria-hidden="true" /><span>{message}</span>{onClose && <button type="button" aria-label="关闭提示" onClick={onClose}><X size={15} /></button>}</div>; };

export const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost'; loading?: boolean }> = ({ variant = 'primary', loading, disabled, children, className = '', ...props }) => <button className={`ds-button ds-button-${variant} ${className}`} disabled={disabled || loading} {...props}>{loading && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}{children}</button>;
