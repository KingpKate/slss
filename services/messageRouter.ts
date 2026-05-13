// =============================================================================
// SLSS V2.0 Frontend Message Router Service
// 消息路由中心 - 前端薄客户端，调用后端 API
// =============================================================================

import { MessagePayload, MessageRouteRule } from '../types';

// --- Rule Management (Backend API) ---

export async function getRouteRules(): Promise<MessageRouteRule[]> {
  try {
    const MOCK_MODE = localStorage.getItem('slss_system_mode') !== 'production';
    if (MOCK_MODE) {
      return getDefaultRules();
    }
    const resp = await fetch('/api/message-router/rules');
    if (resp.ok) return await resp.json();
  } catch (e) {
    console.warn('[MessageRouter] Failed to fetch rules from backend, using defaults');
  }
  return getDefaultRules();
}

export async function addRouteRule(rule: Omit<MessageRouteRule, 'id'>): Promise<any> {
  try {
    const resp = await fetch('/api/message-router/rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rule)
    });
    return await resp.json();
  } catch (e: any) {
    console.error('[MessageRouter] Failed to add rule:', e);
    return { success: false, error: e.message };
  }
}

export async function updateRouteRule(id: number, updates: Partial<MessageRouteRule>): Promise<any> {
  try {
    const resp = await fetch(`/api/message-router/rules/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    return await resp.json();
  } catch (e: any) {
    console.error('[MessageRouter] Failed to update rule:', e);
    return { success: false, error: e.message };
  }
}

export async function deleteRouteRule(id: number): Promise<any> {
  try {
    const resp = await fetch(`/api/message-router/rules/${id}`, {
      method: 'DELETE'
    });
    return await resp.json();
  } catch (e: any) {
    console.error('[MessageRouter] Failed to delete rule:', e);
    return { success: false, error: e.message };
  }
}

// --- Send Notification (Backend API) ---

export async function sendNotification(payload: MessagePayload): Promise<{
  sent: number;
  failed: number;
  results: Array<{ channel: string; success: boolean; error?: string }>;
}> {
  try {
    const MOCK_MODE = localStorage.getItem('slss_system_mode') !== 'production';
    if (MOCK_MODE) {
      console.log('[MessageRouter] Demo mode - send:', payload.event_type, payload.title);
      return { sent: 1, failed: 0, results: [{ channel: 'mock', success: true }] };
    }
    const resp = await fetch('/api/message-router/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return await resp.json();
  } catch (e: any) {
    console.error('[MessageRouter] Send failed:', e);
    return { sent: 0, failed: 1, results: [{ channel: 'error', success: false, error: e.message }] };
  }
}

// --- Notification Config (Backend API) ---

export async function getNotificationConfig(): Promise<any> {
  try {
    const MOCK_MODE = localStorage.getItem('slss_system_mode') !== 'production';
    if (MOCK_MODE) {
      const saved = localStorage.getItem('slss_notification_config');
      if (saved) return JSON.parse(saved);
      return getDefaultConfig();
    }
    const resp = await fetch('/api/message-router/config');
    if (resp.ok) return await resp.json();
  } catch (e) {
    console.warn('[MessageRouter] Failed to fetch config from backend');
  }
  return getDefaultConfig();
}

export async function saveNotificationConfig(config: any): Promise<void> {
  try {
    const MOCK_MODE = localStorage.getItem('slss_system_mode') !== 'production';
    if (MOCK_MODE) {
      localStorage.setItem('slss_notification_config', JSON.stringify(config));
      return;
    }
    await fetch('/api/message-router/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
  } catch (e) {
    console.error('[MessageRouter] Failed to save config:', e);
  }
}

// --- Scheduled Checks (Backend API) ---

export async function checkDeliveryReminders(): Promise<void> {
  try {
    await fetch('/api/message-router/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_type: 'DELIVERY_REMINDER', title: 'Check', content: 'Periodic check' })
    });
  } catch (e) {
    console.warn('[MessageRouter] Delivery reminder check failed');
  }
}

export async function checkInventoryAging(): Promise<void> {
  console.log('[MessageRouter] Checking inventory aging (backend scheduled task)...');
}

export async function checkOverduePayments(): Promise<void> {
  console.log('[MessageRouter] Checking overdue payments (backend scheduled task)...');
}

// --- Default Data (Demo Mode Fallback) ---

function getDefaultRules(): MessageRouteRule[] {
  return [
    {
      id: 'rule-fault-critical' as any,
      event_type: 'FAULT_CRITICAL',
      channel: 'wecom',
      target_roles: ['TECHNICIAN', 'MANAGER'],
      target_users: [],
      template: '严重故障告警: {machine_sn} - {part_name} 故障, 操作人: {operator}',
      is_active: true
    },
    {
      id: 'rule-fault-swap' as any,
      event_type: 'FAULT_SWAP',
      channel: 'wecom',
      target_roles: ['TECHNICIAN'],
      target_users: [],
      template: '换件记录: {machine_sn} - {part_name} 旧SN:{old_sn} → 新SN:{new_sn}',
      is_active: true
    },
    {
      id: 'rule-delivery-reminder' as any,
      event_type: 'DELIVERY_REMINDER',
      channel: 'email',
      target_roles: ['SALES'],
      target_users: [],
      schedule: '0 9 * * *',
      template: '交期提醒: 项目 {project_name} 将于 {delivery_date} 交付, 剩余 {days_left} 天',
      is_active: true
    },
    {
      id: 'rule-arrival' as any,
      event_type: 'ARRIVAL',
      channel: 'wecom',
      target_roles: ['SALES', 'PROCUREMENT'],
      target_users: [],
      template: '到货通知: 采购单 {po_id} 已到货, 快递单号: {tracking_number}',
      is_active: true
    },
    {
      id: 'rule-aging-alert' as any,
      event_type: 'AGING_ALERT',
      channel: 'wecom',
      target_roles: ['SALES', 'PRODUCTION'],
      target_users: [],
      schedule: '0 10 * * *',
      template: '库龄预警: 采购单 {po_id} 物料已到货 {aging_days} 天未领料, 请尽快处理',
      is_active: true
    },
    {
      id: 'rule-settlement-ready' as any,
      event_type: 'SETTLEMENT_READY',
      channel: 'all',
      target_roles: ['FINANCE'],
      target_users: [],
      template: '结算就绪: 项目 {project_name} 已发货, 可发起结算流程',
      is_active: true
    },
    {
      id: 'rule-overdue-payment' as any,
      event_type: 'OVERDUE_PAYMENT',
      channel: 'email',
      target_roles: ['FINANCE', 'SALES'],
      target_users: [],
      schedule: '0 9 * * 1',
      template: '逾期回款: 项目 {project_name} 应回款 {amount_pending} 元, 已逾期 {overdue_days} 天',
      is_active: true
    },
    {
      id: 'rule-order-created' as any,
      event_type: 'ORDER_CREATED',
      channel: 'wecom',
      target_roles: ['TECHNICIAN', 'MANAGER'],
      target_users: [],
      template: '新工单: {order_number} - {customer_name} - {fault_description}',
      is_active: true
    },
    {
      id: 'rule-order-assigned' as any,
      event_type: 'ORDER_ASSIGNED',
      channel: 'wecom',
      target_roles: [],
      target_users: [],
      template: '工单分配: {order_number} 已分配给 {assignee_name}',
      is_active: true
    },
    {
      id: 'rule-order-closed' as any,
      event_type: 'ORDER_CLOSED',
      channel: 'wecom',
      target_roles: ['MANAGER'],
      target_users: [],
      template: '工单完成: {order_number} 已关闭',
      is_active: true
    }
  ];
}

function getDefaultConfig() {
  return {
    smtp: { enabled: false, host: 'smtp.exmail.qq.com', port: 465, secure: true, user: '', pass: '', fromName: 'SLSS System', fromEmail: '' },
    robots: {
      wecom: { enabled: false, webhook: '' },
      dingtalk: { enabled: false, webhook: '' },
      feishu: { enabled: false, webhook: '' }
    }
  };
}
