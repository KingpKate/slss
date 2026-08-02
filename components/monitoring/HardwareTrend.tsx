import { useEffect, useRef } from 'react';
import * as echarts from 'echarts/core';
import { LineChart } from 'echarts/charts';
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { TrendSample } from './mockMonitoring';

echarts.use([LineChart, GridComponent, LegendComponent, TooltipComponent, CanvasRenderer]);

type Props = {
  samples: TrendSample[];
  height?: number | string;
  maxPoints?: number;
};

const WINDOW_SIZE = 300;

export function HardwareTrend({ samples, height = 300, maxPoints = WINDOW_SIZE }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.EChartsType | null>(null);
  const ringRef = useRef<TrendSample[]>([]);

  useEffect(() => {
    if (!hostRef.current) return;
    const chart = echarts.init(hostRef.current, undefined, { renderer: 'canvas', devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2) });
    chartRef.current = chart;
    const resizeObserver = new ResizeObserver(() => chart.resize());
    resizeObserver.observe(hostRef.current);
    return () => {
      resizeObserver.disconnect();
      chart.dispose();
      chartRef.current = null;
      ringRef.current = [];
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || samples.length === 0) return;
    const merged = [...ringRef.current, ...samples];
    ringRef.current = merged.slice(-Math.max(20, maxPoints));
    const categories = ringRef.current.map((sample) => new Date(sample.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    chart.setOption({
      animation: false,
      backgroundColor: 'transparent',
      grid: { top: 30, right: 54, bottom: 28, left: 48 },
      legend: { top: 0, right: 0, textStyle: { color: '#8aa9bf' }, itemWidth: 12, itemHeight: 6 },
      tooltip: { trigger: 'axis', backgroundColor: '#081a2b', borderColor: 'rgba(56,189,248,.45)', textStyle: { color: '#e6f4ff' } },
      xAxis: { type: 'category', boundaryGap: false, data: categories, axisLabel: { color: '#57758c', fontSize: 10, hideOverlap: true }, axisLine: { lineStyle: { color: 'rgba(138,169,191,.24)' } }, splitLine: { show: false } },
      yAxis: [
        { type: 'value', name: 'kW', min: 5, max: 9, nameTextStyle: { color: '#22d3ee' }, axisLabel: { color: '#57758c' }, axisLine: { show: false }, splitLine: { show: false } },
        { type: 'value', name: 'RPM', min: 5000, max: 10000, nameTextStyle: { color: '#facc15' }, axisLabel: { color: '#57758c' }, axisLine: { show: false }, splitLine: { show: false } },
      ],
      series: [
        { name: '功耗', type: 'line', yAxisIndex: 0, showSymbol: false, smooth: 0.18, data: ringRef.current.map((sample) => sample.powerKw), lineStyle: { width: 2, color: '#22d3ee' }, areaStyle: { color: 'rgba(34,211,238,.08)' } },
        { name: '风扇 RPM', type: 'line', yAxisIndex: 1, showSymbol: false, smooth: 0.12, data: ringRef.current.map((sample) => sample.fanRpm), lineStyle: { width: 2, color: '#facc15' } },
      ],
    }, { lazyUpdate: true });
  }, [samples, maxPoints]);

  return <div ref={hostRef} role="img" aria-label="风扇转速与服务器功耗趋势图" style={{ width: '100%', height }} />;
}

export default HardwareTrend;
