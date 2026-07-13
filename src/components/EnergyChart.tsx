interface ChartDataPoint {
  time: string;
  value: number;
  label?: string;
}

interface EnergyChartProps {
  data: ChartDataPoint[];
  title: string;
  color: string;
  unit: string;
  yAxisLabel?: string;
  height?: number;
}

function formatValue(value: number, unit: string): string {
  if (unit === 'Wh' || unit === 'kWh') {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)} MWh`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(2)} kWh`;
    return `${value.toFixed(0)} Wh`;
  }
  if (unit === 'W' || unit === 'kW') {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)} MW`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(2)} kW`;
    return `${value.toFixed(0)} W`;
  }
  if (unit === '€') {
    return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(value);
  }
  if (unit === '%') {
    return `${value.toFixed(1)}%`;
  }
  return `${value.toFixed(2)} ${unit}`;
}

function getYAxisTicks(maxValue: number, minValue: number, unit: string): { value: number; label: string }[] {
  const range = maxValue - minValue || 1;
  const steps = 5;
  return Array.from({ length: steps }, (_, i) => {
    const value = maxValue - (i * range / (steps - 1));
    return { value, label: formatValue(value, unit) };
  });
}

export function EnergyChart({ data, title, color, unit, yAxisLabel, height = 250 }: EnergyChartProps) {
  if (!data.length) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 h-64 flex items-center justify-center">
        <span className="text-gray-500 dark:text-gray-400">Sem dados disponíveis</span>
      </div>
    );
  }

  const maxValue = Math.max(...data.map(d => d.value));
  const minValue = Math.min(...data.map(d => d.value));
  const range = maxValue - minValue || 1;
  const padding = { top: 20, right: 60, bottom: 40, left: 80 };
  const chartHeight = height - padding.top - padding.bottom;
  const chartWidth = 600 - padding.left - padding.right;

  const xScale = (i: number) => padding.left + (i / (data.length - 1)) * chartWidth;
  const yScale = (value: number) => padding.top + chartHeight - ((value - minValue) / range) * chartHeight;

  const points = data.map((d, i) => ({ x: xScale(i), y: yScale(d.value), value: d.value }));
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const areaPath = `${points[0].x},${padding.top + chartHeight} ${path} ${points[points.length - 1].x},${padding.top + chartHeight} Z`;

  const yTicks = getYAxisTicks(maxValue, minValue, unit);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
        {yAxisLabel && <span className="text-xs text-gray-500 dark:text-gray-400">{yAxisLabel}</span>}
      </div>
      <div className="relative" style={{ height: `${height}px`, width: '100%' }}>
        <svg width="100%" height={height} viewBox={`0 0 600 ${height}`} preserveAspectRatio="none">
          <defs>
            <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.3" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          
          {/* Y-axis grid lines */}
          {yTicks.map((tick, i) => (
            <line
              key={i}
              x1={padding.left}
              y1={yScale(tick.value)}
              x2={padding.left + chartWidth}
              y2={yScale(tick.value)}
              stroke="#e5e7eb"
              strokeWidth="0.5"
            />
          ))}
          
          {/* Area under curve */}
          <path
            d={areaPath}
            fill="url(#areaGradient)"
            stroke="none"
          />
          
          {/* Line */}
          <path
            d={path}
            stroke={color}
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          
          {/* Data points */}
          {points.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r="4"
              fill={color}
              stroke="white"
              strokeWidth={2}
            />
          ))}
        </svg>
        
        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 h-full flex flex-col justify-between pr-2 text-xs text-gray-500 dark:text-gray-400 pointer-events-none" style={{ height: `${height}px` }}>
          {yTicks.map((tick, i) => (
            <span key={i} className="text-right" style={{ top: `${yScale(tick.value)}px`, transform: 'translateY(-50%)' }}>
              {tick.label}
            </span>
          ))}
        </div>

        {/* X-axis labels */}
        <div className="absolute bottom-0 left-0 right-0 flex justify-between px-2 mt-2 text-xs text-gray-500 dark:text-gray-400" style={{ paddingLeft: `${padding.left}px`, paddingRight: `${padding.right}px` }}>
          {data.map((d, i) => i % Math.max(1, Math.ceil(data.length / 8)) === 0 && (
            <span key={i} style={{ left: `${(i / (data.length - 1)) * 100}%` }}>{d.label || d.time}</span>
          ))}
        </div>
      </div>
    </div>
  );
}