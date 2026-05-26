// =============================================================================
// SLSS V2.0 Frontend Message Router Service
// 消息路由中心 - 前端薄客户端，调用后端 API
// =============================================================================

import { MessagePayload, MessageRouteRule } from '../types';

// --- Rule Management (Backend API) ---

export async function getRouteRules(): Promise<MessageRouteRule[]> {
  const resp = await fetch('/api/message-router/rules');
  if (resp.ok) return await resp.json();
  console.warn('[MessageRouter] Failed to fetch rules, status:', resp.status);
  return [];
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
    const resp = await fetch('/api/message-router/config');
    if (resp.ok) return await resp.json();
  } catch (e) {
    console.warn('[MessageRouter] Failed to fetch config from backend');
  }
  return getDefaultConfig();
}

export async function saveNotificationConfig(config: any): Promise<void> {
  try {
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

// --- Default Config (sensible defaults when no config exists yet) ---

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
