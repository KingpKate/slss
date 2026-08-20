export type TemperaturePoint = {
  timestamp: number;
  deviceId: string;
  component: string;
  value: number;
};

export type TrendSample = {
  timestamp: number;
  fanRpm: number[];
  powerKw: number;
};
