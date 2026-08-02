const COMPONENTS = Array.from({ length: 8 }, (_, index) => `NPU-${index + 1}`);
const DEVICES = Array.from({ length: 8 }, (_, index) => `NPU-0${index + 1}`);
let sequence = 0;

process.stdout.on('error', (error) => {
  if (error.code === 'EPIPE') process.exit(0);
});

function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }

function createIncrement() {
  const now = Date.now();
  const hours = (now / 3600000) % 48;
  const phase = now / 240000;
  const heatmap = DEVICES.flatMap((deviceId, deviceIndex) => COMPONENTS.map((component, componentIndex) => ({
    deviceId,
    component,
    value: Number(clamp(71 + deviceIndex * 0.85 + componentIndex * 0.35 + Math.sin(phase + deviceIndex * 0.45 + componentIndex * 0.28) * 2.6, 62, 96).toFixed(1)),
  })));
  const fanRpm = Math.round(clamp(7600 + Math.sin(hours * Math.PI * 2 / 0.9 + sequence * 0.02) * 260 + Math.sin(hours * Math.PI * 2 / 0.22) * 90, 6200, 9100));
  const powerKw = Number(clamp(6.9 + Math.sin(hours * Math.PI * 2 / 6.5) * 0.1 + Math.sin(hours * Math.PI * 2 / 1.75) * 0.016, 5.8, 8.2).toFixed(2));
  return { type: 'MONITORING_UPDATE', sequence: sequence++, timestamp: new Date(now).toISOString(), heatmap, trend: { timestamp: new Date(now).toISOString(), powerKw, fanRpm } };
}

console.log(JSON.stringify(createIncrement()));
setInterval(() => console.log(JSON.stringify(createIncrement())), 1000);
