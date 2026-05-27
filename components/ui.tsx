import React, { useEffect, useState } from 'react';
import { RefreshCw, AlertCircle, CheckCircle, Info, X, LucideIcon } from 'lucide-react';

// =============================================================================
// PageHeader
// =============================================================================
export const PageHeader: React.FC<{
  icon?: LucideIcon;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}> = ({ icon: Icon, title, subtitle, action }) => (
  <div className="flex items-center justify-between">
    <div>
      <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
        {Icon && <Icon className="w-7 h-7 text-blue-600" />}
        {title}
      </h1>
      {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
    </div>
    {action}
  </div>
);

// =============================================================================
// LoadingSpinner
// =============================================================================
export const LoadingSpinner: React.FC<{ text?: string; size?: 'sm' | 'md' | 'lg' }> = ({ text = '加载中...', size = 'md' }) => {
  const sizeClasses = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-8 h-8' };
  return (
    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
      <RefreshCw className={`${sizeClasses[size]} animate-spin mb-3`} />
      {text && <span className="text-sm">{text}</span>}
    </div>
  );
};

// =============================================================================
// EmptyState
// =============================================================================
export const EmptyState: React.FC<{
  icon?: LucideIcon;
  title: string;
  description?: string;
}> = ({ icon: Icon, title, description }) => (
  <div className="flex flex-col items-center justify-center py-16 text-gray-400">
    {Icon && <Icon className="w-12 h-12 mb-3 opacity-30" />}
    <p className="text-sm font-medium text-gray-500">{title}</p>
    {description && <p className="text-xs text-gray-400 mt-1">{description}</p>}
  </div>
);

// =============================================================================
// Alert (Success / Error / Info)
// =============================================================================
export const Alert: React.FC<{
  type: 'success' | 'error' | 'info';
  message: string;
  onClose?: () => void;
  autoDismiss?: number;
}> = ({ type, message, onClose, autoDismiss }) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (autoDismiss && autoDismiss > 0) {
      const timer = setTimeout(() => { setVisible(false); onClose?.(); }, autoDismiss);
      return () => clearTimeout(timer);
    }
  }, [autoDismiss, onClose]);

  if (!visible || !message) return null;

  const config = {
    success: { bg: 'bg-green-50 border-green-200 text-green-700', icon: CheckCircle },
    error: { bg: 'bg-red-50 border-red-200 text-red-700', icon: AlertCircle },
    info: { bg: 'bg-blue-50 border-blue-200 text-blue-700', icon: Info },
  }[type];

  const IconComp = config.icon;

  return (
    <div className={`${config.bg} border px-4 py-3 rounded-lg text-sm flex items-center`}>
      <IconComp className="w-4 h-4 mr-2 shrink-0" />
      <span className="flex-1">{message}</span>
      {onClose && (
        <button onClick={() => { setVisible(false); onClose(); }} className="ml-2 p-0.5 rounded hover:bg-black/5">
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};

// =============================================================================
// Modal
// =============================================================================
export const Modal: React.FC<{
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: 'sm' | 'md' | 'lg' | 'xl';
}> = ({ title, onClose, children, footer, width = 'md' }) => {
  const widthClasses = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className={`bg-white rounded-xl shadow-2xl w-full ${widthClasses[width]} max-h-[90vh] flex flex-col`} onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-200 shrink-0">
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
        </div>
        <div className="px-6 py-4 overflow-y-auto flex-1">{children}</div>
        {footer && (
          <div className="px-6 py-4 border-t border-gray-200 shrink-0 flex justify-end space-x-3">{footer}</div>
        )}
      </div>
    </div>
  );
};

// =============================================================================
// Button
// =============================================================================
export const Button: React.FC<{
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md';
  icon?: LucideIcon;
  loading?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit';
  children: React.ReactNode;
}> = ({ variant = 'primary', size = 'md', icon: Icon, loading, disabled, onClick, type = 'button', children }) => {
  const variants = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm',
    secondary: 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50',
    danger: 'bg-red-600 text-white hover:bg-red-700 shadow-sm',
    ghost: 'text-gray-600 hover:bg-gray-100',
  };
  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
  };

  const LoadingIcon = loading ? RefreshCw : Icon;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]}`}
    >
      {LoadingIcon && <LoadingIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />}
      {children}
    </button>
  );
};

// =============================================================================
// FormField
// =============================================================================
export const FormField: React.FC<{
  label: string;
  required?: boolean;
  description?: string;
  children: React.ReactNode;
  className?: string;
}> = ({ label, required, description, children, className }) => (
  <div className={className}>
    <label className="block text-sm font-medium text-gray-700 mb-1">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    {description && <p className="text-xs text-gray-500 mb-1.5">{description}</p>}
    {children}
  </div>
);

// =============================================================================
// Input / Select / Textarea
// =============================================================================
const inputBase = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors';

export const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => (
  <input {...props} className={`${inputBase} ${props.disabled ? 'bg-gray-100 cursor-not-allowed' : ''} ${props.className || ''}`} />
);

export const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = (props) => (
  <select {...props} className={`${inputBase} ${props.disabled ? 'bg-gray-100 cursor-not-allowed' : ''} ${props.className || ''}`} />
);

export const Textarea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement>> = (props) => (
  <textarea {...props} className={`${inputBase} ${props.disabled ? 'bg-gray-100 cursor-not-allowed' : ''} ${props.className || ''}`} />
);

// =============================================================================
// StatCard
// =============================================================================
export const StatCard: React.FC<{
  label: string;
  value: string | number;
  icon?: LucideIcon;
  color?: string;
}> = ({ label, value, icon: Icon, color = 'blue' }) => {
  const colorMap: Record<string, { text: string; bg: string }> = {
    blue: { text: 'text-blue-600', bg: 'bg-blue-50' },
    green: { text: 'text-green-600', bg: 'bg-green-50' },
    yellow: { text: 'text-yellow-600', bg: 'bg-yellow-50' },
    red: { text: 'text-red-600', bg: 'bg-red-50' },
    purple: { text: 'text-purple-600', bg: 'bg-purple-50' },
    orange: { text: 'text-orange-600', bg: 'bg-orange-50' },
    gray: { text: 'text-gray-600', bg: 'bg-gray-50' },
  };
  const c = colorMap[color] || colorMap.blue;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{label}</p>
        {Icon && <div className={`${c.bg} p-2 rounded-lg`}><Icon className={`w-4 h-4 ${c.text}`} /></div>}
      </div>
      <p className={`text-2xl font-bold ${c.text} mt-1`}>{value}</p>
    </div>
  );
};

// =============================================================================
// StatusBadge
// =============================================================================
export const StatusBadge: React.FC<{
  label: string;
  color: 'green' | 'blue' | 'yellow' | 'red' | 'gray' | 'purple' | 'orange';
  icon?: LucideIcon;
}> = ({ label, color, icon: Icon }) => {
  const colorMap: Record<string, string> = {
    green: 'bg-green-100 text-green-800',
    blue: 'bg-blue-100 text-blue-800',
    yellow: 'bg-yellow-100 text-yellow-800',
    red: 'bg-red-100 text-red-800',
    gray: 'bg-gray-100 text-gray-800',
    purple: 'bg-purple-100 text-purple-800',
    orange: 'bg-orange-100 text-orange-800',
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colorMap[color]}`}>
      {Icon && <Icon className="w-3 h-3 mr-1" />}
      {label}
    </span>
  );
};

// =============================================================================
// DataTable
// =============================================================================
export const DataTable: React.FC<{
  columns: { key: string; label: string; className?: string; render?: (row: any) => React.ReactNode }[];
  data: any[];
  emptyIcon?: LucideIcon;
  emptyText?: string;
  loading?: boolean;
  onRowClick?: (row: any) => void;
}> = ({ columns, data, emptyIcon, emptyText = '暂无数据', loading, onRowClick }) => {
  if (loading) return <LoadingSpinner />;
  if (data.length === 0) return <EmptyState icon={emptyIcon} title={emptyText} />;

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {columns.map(col => (
              <th key={col.key} className={`px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider ${col.className || ''}`}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {data.map((row, i) => (
            <tr key={row.id || i} className={`hover:bg-blue-50/30 transition-colors ${onRowClick ? 'cursor-pointer' : ''}`} onClick={() => onRowClick?.(row)}>
              {columns.map(col => (
                <td key={col.key} className={`px-4 py-3 text-sm ${col.className || ''}`}>
                  {col.render ? col.render(row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// =============================================================================
// FilterBar
// =============================================================================
export const FilterBar: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
    <div className="flex flex-wrap gap-3 items-center">{children}</div>
  </div>
);

// =============================================================================
// ConfirmDialog
// =============================================================================
export const ConfirmDialog: React.FC<{
  title: string;
  message: string;
  confirmLabel?: string;
  variant?: 'danger' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ title, message, confirmLabel = '确认', variant = 'primary', onConfirm, onCancel }) => (
  <Modal title={title} onClose={onCancel} width="sm" footer={
    <>
      <Button variant="secondary" onClick={onCancel}>取消</Button>
      <Button variant={variant} onClick={onConfirm}>{confirmLabel}</Button>
    </>
  }>
    <p className="text-sm text-gray-600">{message}</p>
  </Modal>
);
