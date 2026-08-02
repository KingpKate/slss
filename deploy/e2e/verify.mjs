const base = process.env.SLSS_E2E_URL || 'http://127.0.0.1:18080/slss/api/v1';
const username = process.env.SLSS_E2E_USER || 'e2e_admin';
const password = process.env.SLSS_E2E_PASSWORD || 'SlssE2E!2026';

async function call(path, options = {}, token) {
  const response = await fetch(base + path, {
    ...options,
    headers: {
      ...(options.body ? {'Content-Type': 'application/json'} : {}),
      ...(token ? {Authorization: `Bearer ${token}`} : {}),
      ...(options.headers || {})
    }
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`${options.method || 'GET'} ${path}: ${response.status} ${JSON.stringify(body)}`);
  return body;
}

const suffix = Date.now();
const health = await call('/health');
const login = await call('/auth/login', {method: 'POST', body: JSON.stringify({username, password})});
const token = login.token;
const batch = await call('/production/batches', {method: 'POST', body: JSON.stringify({batchName: `E2E-${suffix}`})}, token);
await call(`/production/batches/${batch.id}/commit`, {method: 'POST', body: JSON.stringify([{machineSn: `E2E-SN-${suffix}`, model: 'E2E-SERVER'}])}, token);
const asset = await call(`/assets/E2E-SN-${suffix}`, {}, token);
const order = await call('/service-orders', {method: 'POST', body: JSON.stringify({orderNumber: `E2E-ORDER-${suffix}`, customerName: 'E2E Customer', faultDescription: 'Power failure', machineSn: asset.machineSn})}, token);
await call(`/service-orders/${order.id}/assignment`, {method: 'POST', body: JSON.stringify({userId: 1, slaHours: 72, reason: 'E2E assignment'})}, token);
await call(`/service-orders/${order.id}/transitions`, {method: 'POST', body: JSON.stringify({targetStatus: 'ASSIGNED', reason: 'E2E assignment'})}, token);
await call(`/service-orders/${order.id}/parts`, {method: 'POST', body: JSON.stringify({partName: 'Power Supply', oldSn: `OLD-${suffix}`, newSn: `NEW-${suffix}`})}, token);
await call(`/service-orders/${order.id}/tests`, {method: 'POST', body: JSON.stringify({testType: 'Burn-in', result: 'PASS', details: 'E2E test'})}, token);
await call(`/service-orders/${order.id}/logistics`, {method: 'POST', body: JSON.stringify({direction: 'OUTBOUND', carrier: 'E2E Express', trackingNumber: `TRACK-${suffix}`})}, token);
await call(`/service-orders/${order.id}/report`, {method: 'PUT', body: JSON.stringify({diagnosis: 'Power supply failure', resolution: 'Replaced power supply', testConclusion: 'PASS'})}, token);
const history = await call(`/service-orders/${order.id}/status-history`, {}, token);
const lifecycle = await call(`/assets/${asset.machineSn}/lifecycle`, {}, token);
const parts = await call(`/service-orders/${order.id}/parts`, {}, token);
const tests = await call(`/service-orders/${order.id}/tests`, {}, token);
const logistics = await call(`/service-orders/${order.id}/logistics`, {}, token);
const report = await call(`/service-orders/${order.id}/report`, {}, token);

console.log(JSON.stringify({
  health: health.status,
  login: login.username,
  authorities: login.authorities.length,
  batchId: batch.id,
  asset: asset.machineSn,
  orderId: order.id,
  historyEvents: history.length,
  lifecycleEvents: lifecycle.length,
  parts: parts.length,
  tests: tests.length,
  logistics: logistics.length,
  report: report.id
}, null, 2));
