import type { OrderStatus } from '../types';

const deployedContext = typeof window === 'undefined' ? '' : window.location.pathname.split('/').slice(0, 2).join('/');
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || deployedContext).replace(/\/$/, '');

export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string) { super(message); }
}

let refreshPromise: Promise<any> | null = null;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const isForm = init?.body instanceof FormData;
  const token = localStorage.getItem('slss_token');
  const response = await fetch(`${API_BASE_URL}/api/v1${path}`, {
    ...init,
    credentials: 'include',
    headers: { ...(isForm ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init?.headers || {}) },
  });
  const authRetry = Boolean((init?.headers as Record<string,string> | undefined)?.['X-Auth-Retry']);
  // A 403 means the token is valid but the caller lacks this permission. Do
  // not rotate the session or redirect to login in that case; only 401 is an
  // authentication failure eligible for refresh/replay.
  if (response.status === 401 && token && !authRetry && path !== '/auth/login' && path !== '/auth/refresh') {
    const errBody = await response.clone().json().catch(() => ({} as any));
    try {
      refreshPromise ||= fetch(`${API_BASE_URL}/api/v1/auth/refresh`, { method: 'POST', credentials: 'include' })
        .then(async refreshed => {
          if (!refreshed.ok) throw new Error('refresh failed');
          return refreshed.json();
        }).finally(() => { refreshPromise = null; });
      const body = await refreshPromise as { token?: string; username?: string; authorities?: string[]; mustChangePassword?: boolean };
      if (body.token) {
        const previous = JSON.parse(localStorage.getItem('slss_user') || '{}');
        const synchronizedUser = { ...previous, username: body.username || previous.username, permissions: (body.authorities || []).map(a => a.replace(/^PERM_/, '')), mustChangePassword: body.mustChangePassword };
        localStorage.setItem('slss_user', JSON.stringify(synchronizedUser));
        window.dispatchEvent(new CustomEvent('slss-session-updated', { detail: synchronizedUser }));
        localStorage.setItem('slss_token', body.token);
        return request<T>(path, { ...init, headers: { ...(init?.headers || {}), 'X-Auth-Retry': '1' } });
      }
    } catch { /* session expiry is handled below */ }
    localStorage.removeItem('slss_token');
    localStorage.removeItem('slss_user');
    if (typeof window !== 'undefined' && !window.location.hash.includes('#/login')) window.location.hash = '#/login';
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const detail = body.message || body.error || `API 请求失败 (${response.status})`;
    const endpoint = body.path || `${API_BASE_URL}/api/v1${path}`;
    throw new ApiError(response.status, `${detail} [${response.status} ${endpoint}]`, body.code);
  }
  if (response.status === 204 || response.headers.get('content-length') === '0') return undefined as T;
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

function normalizeOrder(raw: any) {
  return {
    ...raw,
    order_number: raw.order_number ?? raw.orderNumber ?? '',
    customer_name: raw.customer_name ?? raw.customerName ?? '',
    fault_description: raw.fault_description ?? raw.faultDescription ?? '',
    machine_sn: raw.machine_sn ?? raw.machineSn ?? '',
    assigned_to: raw.assigned_to ?? raw.assignedTo,
    sla_due_at: raw.sla_due_at ?? raw.slaDueAt,
    sla_paused_at: raw.sla_paused_at ?? raw.slaPausedAt,
    sla_remaining_seconds: raw.sla_remaining_seconds ?? raw.slaRemainingSeconds,
    created_at: raw.created_at ?? raw.createdAt ?? '',
    updated_at: raw.updated_at ?? raw.updatedAt ?? raw.created_at ?? raw.createdAt ?? '',
    discovery_phase: raw.discovery_phase ?? raw.discoveryPhase,
    actual_fault_description: raw.actual_fault_description ?? raw.actualFaultDescription,
    shipment_config_json: raw.shipment_config_json ?? raw.shipmentConfigJson,
    received_config_json: raw.received_config_json ?? raw.receivedConfigJson,
    report_data_json: raw.report_data_json ?? raw.reportDataJson,
    tracking_number: raw.tracking_number ?? raw.trackingNumber,
    shipment_model: raw.shipment_model ?? raw.shipmentModel,
  };
}

function normalizeAsset(raw: any) {
  return {
    ...raw,
    machine_sn: raw.machine_sn ?? raw.machineSn ?? '',
    contract_no: raw.contract_no ?? raw.contractNo ?? '',
    invoice_date: raw.invoice_date ?? raw.invoiceDate ?? '',
    batch_name: raw.batch_name ?? raw.batchName ?? '',
  };
}

export const api = {
  login: (username: string, password: string) =>
    request<{ token: string; username: string; authorities: string[]; mustChangePassword: boolean }>('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  refreshSession: () => request<{ token: string; username: string; authorities: string[]; mustChangePassword: boolean }>('/auth/refresh', { method: 'POST' }),
  currentSession: () => request<{ token: null; username: string; authorities: string[]; mustChangePassword: boolean }>('/auth/me'),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<void>('/me/password', { method: 'PUT', body: JSON.stringify({ currentPassword, newPassword }) }),
  listUsers: (page = 0, size = 100) => request<{content:any[];totalElements:number;totalPages:number}>(`/users?page=${page}&size=${size}`),
  createUser: (payload: unknown) => request<any>('/users', { method: 'POST', body: JSON.stringify(payload) }),
  updateUserStatus: (id: number, status: string) => request<any>(`/users/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
  updateUser: (id: number, payload: any) => request<any>(`/users/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteUser: (id: number) => request<void>(`/users/${id}`, { method: 'DELETE' }),
  updateUserPermissions: (id: number, permissions: string[]) => request<any>(`/users/${id}/permissions`, { method: 'PUT', body: JSON.stringify({ permissions }) }),
  permissionDetail: (id: number) => request<any>(`/permission-center/users/${id}/detail`),
  simulatePermissions: (username: string) => request<any>(`/permission-center/simulate?username=${encodeURIComponent(username)}`),
  permissionOverrides: (id: number, values: any[]) => request<any>(`/permission-center/users/${id}/overrides`, { method: 'PUT', body: JSON.stringify(values) }),
  permissionScopes: (subjectType: string, subjectId: number) => request<any[]>(`/permission-center/scopes?subjectType=${subjectType}&subjectId=${subjectId}`),
  savePermissionScope: (payload: any) => request<any>('/permission-center/scopes', { method: 'PUT', body: JSON.stringify(payload) }),
  deletePermissionScope: (id: number) => request<void>(`/permission-center/scopes/${id}`, { method: 'DELETE' }),
  permissionAudit: () => request<any[]>('/permission-center/audit'),
  permissionApprovals: (status = 'PENDING') => request<any[]>(`/permission-center/approvals?status=${status}`),
  createPermissionApproval: (payload: any) => request<any>('/permission-center/approvals', { method: 'POST', body: JSON.stringify(payload) }),
  reviewPermissionApproval: (id: number, payload: any) => request<any>(`/permission-center/approvals/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  // Permission groups are intentionally separate from user roles.  A group
  // carries a reusable permission set and membership is managed explicitly;
  // existing per-user permission APIs remain unchanged for backwards
  // compatibility.
  permissionGroups: () => request<any[]>('/permission-groups'),
  createPermissionGroup: (payload: { name: string; description?: string }) => request<any>('/permission-groups', { method: 'POST', body: JSON.stringify(payload) }),
  updatePermissionGroup: (id: number, payload: { name?: string; description?: string; enabled?: boolean; version?: number }) => request<any>(`/permission-groups/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deletePermissionGroup: (id: number) => request<void>(`/permission-groups/${id}`, { method: 'DELETE' }),
  updatePermissionGroupPermissions: (id: number, permissions: string[], version?: number) => request<any>(`/permission-groups/${id}/permissions`, { method: 'PUT', body: JSON.stringify({ permissions, version }) }),
  updatePermissionGroupMembers: (id: number, userIds: number[], version?: number) => request<any>(`/permission-groups/${id}/members`, { method: 'PUT', body: JSON.stringify({ groupIds: userIds, version }) }),
  updatePermissionGroupAggregate: (id: number, payload: { name: string; description?: string; enabled?: boolean; permissions: string[]; userIds: number[]; version?: number }) => request<any>(`/permission-groups/${id}/aggregate`, { method: 'PUT', body: JSON.stringify(payload) }),
  resetUserPassword: (id: number, newPassword: string) => request<void>(`/users/${id}/password`, { method: 'PUT', body: JSON.stringify({ newPassword }) }),
  auditLogs: (page = 0, size = 50, action = '') => request<{content:any[];totalElements:number;totalPages:number}>(`/audit-logs?page=${page}&size=${size}${action ? `&action=${encodeURIComponent(action)}` : ''}`),
  dashboardSummary: () => request<any>('/dashboard/summary'),
  dashboardStatistics: () => request<any>('/dashboard/statistics'),
  dashboardAlerts: () => request<{overdue:any[];recurring:any[]}>('/dashboard/alerts'),
  dashboardProduction: () => request<any>('/dashboard/production'),
  sessions: (page = 0, size = 20) => request<{content:any[];totalElements:number;totalPages:number}>(`/sessions/me?page=${page}&size=${size}`),
  allSessions: (page = 0, size = 20) => request<{content:any[];totalElements:number;totalPages:number}>(`/sessions?page=${page}&size=${size}`),
  revokeSession: (id:number) => request<void>(`/sessions/${id}`, { method: 'DELETE' }),
  revokeAnySession: (id:number) => request<void>(`/sessions/admin/${id}`, { method: 'DELETE' }),
  revokeUserSessions: (username:string) => request<void>(`/sessions/users/${encodeURIComponent(username)}`, { method: 'DELETE' }),
  tenants: (page = 0, size = 50) => request<{content:any[];totalElements:number;totalPages:number}>(`/admin/tenants?page=${page}&size=${size}`),
  createTenant: (payload:any) => request<any>('/admin/tenants',{method:'POST',body:JSON.stringify(payload)}),
  bindTenantUser: (tenantId:number,userId:number) => request<void>(`/admin/tenants/${tenantId}/users/${userId}`,{method:'PUT'}),
  migrateTenantAsset: (tenantId:number,machineSn:string) => request<void>(`/admin/tenants/${tenantId}/assets/${encodeURIComponent(machineSn)}`,{method:'PUT'}),
  portalAsset: (machineSn: string) => request<any>(`/portal/assets/${encodeURIComponent(machineSn)}`),
  health: () => request<{ status: string }>('/health'),
  systemStatus: () => request<any>('/system/status'),
  systemSettings: () => request<any>('/settings'),
  branding: () => request<{ appName: string; theme: string; logo?: string }>('/settings/branding'),
  updateSystemSettings: (payload: any) => request<any>('/settings', { method: 'PUT', body: JSON.stringify(payload) }),
  aiSettings: () => request<any>('/settings/ai'),
  updateAiSettings: (payload: any) => request<any>('/settings/ai', { method: 'PUT', body: JSON.stringify(payload) }),
  testAiConnection: (payload: any = {}) => request<{ message: string }>('/ai/test', { method: 'POST', body: JSON.stringify(payload) }),
  analyzeAi: (payload: { faultDescription: string; machineConfig?: string; logs?: string }) => request<any>('/ai/analyze', { method: 'POST', body: JSON.stringify(payload) }),
  companyLogo: () => request<{ value: string }>('/settings/company-logo'),
  updateCompanyLogo: (value: string) => request<{ value: string }>('/settings/company-logo', { method: 'PUT', body: JSON.stringify({ value }) }),
  listOrders: (query = '') => request<unknown[]>(`/service-orders${query ? `?${query}` : ''}`),
  transitionOrder: (id: number, targetStatus: OrderStatus, reason?: string) =>
    request(`/service-orders/${id}/transitions`, { method: 'POST', body: JSON.stringify({ targetStatus, reason }) }),
  asset: (machineSn: string) => request(`/assets/${encodeURIComponent(machineSn)}`),
  lifecycle: (machineSn: string) => request<any[]>(`/assets/${encodeURIComponent(machineSn)}/lifecycle`),
  salesInitiations: () => request<unknown[]>('/sales-initiations'),
  createSalesInitiation: (payload:any) => request<any>('/sales-initiations',{method:'POST',body:JSON.stringify(payload)}),
  transitionSalesInitiation: (id:number,targetStatus:string,comment?:string) => request<any>(`/sales-initiations/${id}/transitions`,{method:'POST',body:JSON.stringify({targetStatus,comment})}),
  procurementProjects: () => request<any[]>('/procurement-projects'),
  procurementQuotations: (id:number) => request<any[]>(`/procurement-projects/${id}/quotations`),
  createQuotation: (id:number,payload:any) => request<any>(`/procurement-projects/${id}/quotations`,{method:'POST',body:JSON.stringify(payload)}),
  selectQuotation: (id:number,quoteId:number) => request<any>(`/procurement-projects/${id}/quotations/${quoteId}/select`,{method:'POST'}),
  serverRequirements: (id:number) => request<any[]>(`/sales-initiations/${id}/requirements/servers`),
  addServerRequirement: (id:number,payload:any) => request<any>(`/sales-initiations/${id}/requirements/servers`,{method:'POST',body:JSON.stringify(payload)}),
  deleteServerRequirement: (id:number,requirementId:number) => request<void>(`/sales-initiations/${id}/requirements/servers/${requirementId}`,{method:'DELETE'}),
  softwareRequirements: (id:number) => request<any[]>(`/sales-initiations/${id}/requirements/software`),
  addSoftwareRequirement: (id:number,payload:any) => request<any>(`/sales-initiations/${id}/requirements/software`,{method:'POST',body:JSON.stringify(payload)}),
  deleteSoftwareRequirement: (id:number,requirementId:number) => request<void>(`/sales-initiations/${id}/requirements/software/${requirementId}`,{method:'DELETE'}),
};

export const productionApi = {
  scanTemplates: () => request<any[]>('/scan/templates'),
  createScanTemplate: (payload: unknown) => request<any>('/scan/templates', { method: 'POST', body: JSON.stringify(payload) }),
  updateScanTemplate: (id: number, payload: unknown) => request<any>(`/scan/templates/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteScanTemplate: (id: number) => request<void>(`/scan/templates/${id}`, { method: 'DELETE' }),
  scanTables: () => request<any[]>('/scan/tables'),
  scanTablesAll: () => request<any[]>('/scan/tables/all'),
  createScanTable: (templateId: number, quantity: number, dispatchOrderNo?: string, disableAutoFillPartModels = false) => request<any>('/scan/tables', { method: 'POST', body: JSON.stringify({ templateId, quantity, dispatchOrderNo, disableAutoFillPartModels }) }),
  saveScanRow: (tableId: number, rowNumber: number, values: unknown[]) => request<any>(`/scan/tables/${tableId}/rows/${rowNumber}`, { method: 'PUT', body: JSON.stringify(values) }),
  completeScanRow: (tableId: number, rowNumber: number) => request<any>(`/scan/tables/${tableId}/rows/${rowNumber}/complete`, { method: 'POST' }),
  deleteScanTable: (tableId: number) => request<void>(`/scan/tables/${tableId}`, { method: 'DELETE' }),
  deleteScanColumn: (tableId: number, fieldKey: string) => request<any>(`/scan/tables/${tableId}/fields/${encodeURIComponent(fieldKey)}`, { method: 'DELETE' }),
  addScanColumn: (tableId: number, fieldKey: string, label: string, afterKey: string) => request<any>(`/scan/tables/${tableId}/fields`, { method: 'POST', body: JSON.stringify({ key: fieldKey, label, type: /sn|序列号/i.test(`${fieldKey} ${label}`) ? 'SN' : 'TEXT', required: false, afterKey }) }),
  listAssets: () => request<any[]>('/assets').then(rows => rows.map(normalizeAsset)),
  getAsset: (machineSn: string) => request<any>(`/assets/${encodeURIComponent(machineSn)}`).then(normalizeAsset),
  repairLookup: (serialNo: string) => request<any>(`/assets/repair-lookup/${encodeURIComponent(serialNo)}`).then(normalizeAsset),
  forceUpdateCompletedAsset: (machineSn: string, components: unknown[]) => request<any>(`/assets/${encodeURIComponent(machineSn)}/force-scan`, { method: 'PUT', body: JSON.stringify({ components }) }).then(normalizeAsset),
  createBatch: (batchName: string) => request<unknown>('/production/batches', { method: 'POST', body: JSON.stringify({ batchName }) }),
  saveDraftRow: (id: number, row: unknown) => request<unknown>(`/production/batches/${id}/draft-rows`, { method: 'POST', body: JSON.stringify(row) }),
  saveDraftComponents: (id: number, machineSn: string, rows: unknown[]) => request<void>(`/production/batches/${id}/draft-rows/${encodeURIComponent(machineSn)}/components`, { method: 'PUT', body: JSON.stringify(rows) }),
  duplicateSn: (serialNo: string, excludeScanTableId?: number, excludeRowNumber?: number) => request<{serialNo?:string;machineSn?:string;component?:string}>(`/production/batches/duplicate-sn?serialNo=${encodeURIComponent(serialNo)}${excludeScanTableId ? `&excludeScanTableId=${excludeScanTableId}` : ''}${excludeRowNumber ? `&excludeRowNumber=${excludeRowNumber}` : ''}`),
  statistics: (from:string,to:string) => request<any>(`/production/batches/statistics?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
  commitBatch: (id: number, rows: unknown[]) => request<unknown>(`/production/batches/${id}/commit`, { method: 'POST', body: JSON.stringify(rows) }),
  importExcel: (batchName: string, file: File) => { const body = new FormData(); body.append('batchName', batchName); body.append('file', file); return request<unknown>('/production/imports', { method: 'POST', body, headers: {} }); },
  submitImportJob: (batchName:string,file:File) => { const body=new FormData();body.append('batchName',batchName);body.append('file',file);return request<any>('/production/import-jobs',{method:'POST',body,headers:{}}); },
  cancelImportJob: (id:number) => request<any>(`/production/import-jobs/${id}/cancel`,{method:'POST'}),
  retryImportJob: (id:number) => request<any>(`/production/import-jobs/${id}/retry`,{method:'POST'}),
  importJobFailures: (id:number) => request<any[]>(`/production/import-jobs/${id}/failures`),
};

export const afterSalesApi = {
  listOrders: (query = '') => request<any[]>(`/service-orders${query ? `?${query}` : ''}`).then(rows => rows.map(normalizeOrder)),
  getOrder: (id: number) => request<any>(`/service-orders/${id}`).then(normalizeOrder),
  createOrder: (payload: unknown) => request<any>('/service-orders', { method: 'POST', body: JSON.stringify(payload) }).then(normalizeOrder),
  updateOrder: (id:number,payload:unknown) => request<any>(`/service-orders/${id}`,{method:'PATCH',body:JSON.stringify(payload)}).then(normalizeOrder),
  transition: (id: number, targetStatus: OrderStatus, reason?: string) => api.transitionOrder(id, targetStatus, reason),
  addPart: (id:number,payload:unknown) => request(`/service-orders/${id}/parts`,{method:'POST',body:JSON.stringify(payload)}),
  addTest: (id:number,payload:unknown) => request(`/service-orders/${id}/tests`,{method:'POST',body:JSON.stringify(payload)}),
  addLogistics: (id:number,payload:unknown) => request(`/service-orders/${id}/logistics`,{method:'POST',body:JSON.stringify(payload)}),
  saveReport: (id:number,payload:unknown) => request(`/service-orders/${id}/report`,{method:'PUT',body:JSON.stringify(payload)}),
  reportDownloadToken: (id:number) => request<{token:string;expiresAt:number}>(`/service-orders/${id}/report/download-token`,{method:'POST'}),
  parts: (id:number) => request<any[]>(`/service-orders/${id}/parts`),
  tests: (id:number) => request<any[]>(`/service-orders/${id}/tests`),
  logistics: (id:number) => request<any[]>(`/service-orders/${id}/logistics`),
  report: (id:number) => request<any>(`/service-orders/${id}/report`),
};
