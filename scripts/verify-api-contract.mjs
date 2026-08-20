import { readFileSync } from 'node:fs';

const client = readFileSync('services/apiClient.ts', 'utf8');
const required = [
  "'/auth/login'",
  "'/auth/refresh'",
  "'/auth/logout'",
  '/assets/page',
  '/service-orders/page',
  '/performance/assignments/inbox',
  "'/settings/ai/channels",
];
const missing = required.filter((entry) => !client.includes(entry));
if (missing.length) {
  console.error(`API contract entries missing from services/apiClient.ts: ${missing.join(', ')}`);
  process.exit(1);
}
console.log(`API contract smoke check passed (${required.length} entries).`);
