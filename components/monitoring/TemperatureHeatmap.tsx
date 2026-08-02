import { useEffect, useRef } from 'react';
import * as echarts from 'echarts/core';
import { HeatmapChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, VisualMapComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { TemperaturePoint } from './mockMonitoring';

echarts.use([HeatmapChart, GridComponent, TooltipComponent, VisualMapComponent, CanvasRenderer]);

type Props = {
  points: TemperaturePoint[];
  height?: number | string;
};

const palette = ['#22d3ee', '#38bdf8', '#facc15', '#fb923c', '#f43f5e'];

export function TemperatureHeatmap({ points, height = 300 }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.EChartsType | null>(null);

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
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || points.length === 0) return;
    const devices = [...new Set(points.map((point) => point.deviceId))];
    const components = [...new Set(points.map((point) => point.component))];
    const data = points.map((point) => [
      components.indexOf(point.component),
      devices.indexOf(point.deviceId),
      point.value,
    ]);

    chart.setOption({
      animation: false,
      backgroundColor: 'transparent',
      grid: { top: 12, right: 18, bottom: 42, left: 56 },
      tooltip: {
        backgroundColor: '#081a2b',
        borderColor: 'rgba(56,189,248,.45)',
        textStyle: { color: '#e6f4ff' },
        formatter: (params: { data: [number, number, number] }) => {
          const [componentIndex, deviceIndex, value] = params.data;
          return `${devices[deviceIndex]} · ${components[componentIndex]}<br/><b>${value}°C</b>`;
        },
      },
      xAxis: { type: 'category', data: components, axisLabel: { color: '#8aa9bf', fontSize: 10 }, axisLine: { lineStyle: { color: 'rgba(138,169,191,.24)' } }, splitLine: { show: false } },
      yAxis: { type: 'category', data: devices, axisLabel: { color: '#8aa9bf', fontSize: 10 }, axisLine: { show: false }, splitLine: { show: false } },
      visualMap: { min: 60, max: 100, calculable: false, orient: 'horizontal', left: 'center', bottom: 0, itemWidth: 90, itemHeight: 8, text: ['HOT', 'COOL'], textStyle: { color: '#8aa9bf', fontSize: 10 }, inRange: { color: palette } },
      series: [{ type: 'heatmap', data, progressive: 400, emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(34,211,238,.55)' } } }],
    }, { lazyUpdate: true });
  }, [points]);

  return <div ref={hostRef} role="img" aria-label="8 卡 NPU 温度热力图" style={{ width: '100%', height }} />;
}

export default TemperatureHeatmap;
