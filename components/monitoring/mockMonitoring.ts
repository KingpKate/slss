export type DeviceState = 'ONLINE' | 'OFFLINE' | 'WARNING' | 'FAULT' | 'MAINTENANCE' | 'UNKNOWN';

export type TemperaturePoint = {
  deviceId: string;
  component: string;
  value: number;
};

export type TrendSample = {
  timestamp: string;
  powerKw: number;
  fanRpm: number;
};

export type MonitoringIncrement = {
  type: 'MONITORING_UPDATE';
  sequence: number;
  timestamp: string;
  heatmap: TemperaturePoint[];
  trend: TrendSample;
};

const COMPONENTS = ['NPU-1', 'NPU-2', 'NPU-3', 'NPU-4', 'NPU-5', 'NPU-6', 'NPU-7', 'NPU-8'];
const DEVICE_IDS = ['NPU-01', 'NPU-02', 'NPU-03', 'NPU-04', 'NPU-05', 'NPU-06', 'NPU-07', 'NPU-08'];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function createNpuHeatmap(now = Date.now()): TemperaturePoint[] {
  const phase = now / 240000;
  return DEVICE_IDS.flatMap((deviceId, deviceIndex) =>
    COMPONENTS.map((component, componentIndex) => {
      const thermalWave = Math.sin(phase + deviceIndex * 0.45 + componentIndex * 0.28) * 2.6;
      const rackGradient = deviceIndex * 0.85 + componentIndex * 0.35;
      return {
        deviceId,
        component,
        value: Number(clamp(71 + rackGradient + thermalWave, 62, 96).toFixed(1)),
      };
    }),
  );
}

export function createNpuTrendSample(now = Date.now(), sequence = 0): TrendSample {
  const hours = (now / 3600000) % 48;
  const loadWave = Math.sin(hours * Math.PI * 2 / 6.5) * 10;
  const thermalWave = Math.sin(hours * Math.PI * 2 / 1.75) * 3;
  const fanWave = Math.sin(hours * Math.PI * 2 / 0.9 + sequence * 0.02) * 260;
  const fanHarmonic = Math.sin(hours * Math.PI * 2 / 0.22) * 90;
  return {
    timestamp: new Date(now).toISOString(),
    powerKw: Number(clamp(6.9 + loadWave / 100 + thermalWave / 180, 5.8, 8.2).toFixed(2)),
    fanRpm: Math.round(clamp(7600 + fanWave + fanHarmonic, 6200, 9100)),
  };
}

export function createMonitoringIncrement(sequence = 0): MonitoringIncrement {
  const timestamp = Date.now();
  return {
    type: 'MONITORING_UPDATE',
    sequence,
    timestamp: new Date(timestamp).toISOString(),
    heatmap: createNpuHeatmap(timestamp),
    trend: createNpuTrendSample(timestamp, sequence),
  };
}

export function subscribeMockMonitoring(
  onUpdate: (update: MonitoringIncrement) => void,
  intervalMs = 1000,
): () => void {
  let sequence = 0;
  const timer = window.setInterval(() => onUpdate(createMonitoringIncrement(sequence++)), intervalMs);
  onUpdate(createMonitoringIncrement(sequence++));
  return () => window.clearInterval(timer);
}
