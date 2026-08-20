const base = (process.env.SLSS_BASE_URL || 'http://127.0.0.1:8080/slss').replace(/\/$/, '');
const endpoints = ['/actuator/health', '/api/v1/health'];
const started = performance.now();
const results = [];
for (const endpoint of endpoints) {
  const t = performance.now();
  try {
    const response = await fetch(`${base}${endpoint}`);
    results.push({ endpoint, status: response.status, ms: Math.round(performance.now() - t) });
  } catch (error) {
    results.push({ endpoint, error: String(error), ms: Math.round(performance.now() - t) });
  }
}
console.log(JSON.stringify({ base, totalMs: Math.round(performance.now() - started), results }, null, 2));
if (results.every((item) => item.status !== 200)) process.exitCode = 1;
