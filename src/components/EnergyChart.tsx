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
  height?: number;
}

export function EnergyChart({ data, title, color, height = 250 }: EnergyChartProps) {
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
  const padding = { top: 20, right: 40, bottom: 40, left: 50 };
  const chartHeight = height - padding.top - padding.bottom;
  const chartWidth = 500 - padding.left - padding.right;

  const xScale = (i: number) => padding.left + (i / (data.length - 1)) * chartWidth;
  const yScale = (value: number) => padding.top + chartHeight - ((value - minValue) / range) * chartHeight;

  const points = data.map((d, i) => ({ x: xScale(i), y: yScale(d.value), value: d.value }));
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const areaPath = `${points[0].x},${padding.top + chartHeight} ${path} ${points[points.length - 1].x},${padding.top + chartHeight} Z`;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{title}</h3>
      <div className="relative h-[{height}px]">
        <svg width="100%" height={height} viewBox={`0 0 500 ${height}`} preserveAspectRatio="none">
          <defs>
            <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.3" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          
          {/* Y-axis grid lines */}
          {[0, 1, 2, 3, 4].map((i) => (
            <line
              key={i}
              x1={padding.left}
              y1={padding.top + i * (chartHeight / 4)}
              x2={padding.left + chartWidth}
              y2={padding.top + i * (chartHeight / 4)}
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
              r={4}
              fill={color}
              stroke="white"
              strokeWidth={2}
            />
          ))}
        </svg>
        
        {/* X-axis labels */}
        <div className="flex justify-between px-2 mt-2 text-xs text-gray-500 dark:text-gray-400">
          {data.map((d, i) => i % Math.max(1, Math.ceil(data.length / 6)) === 0 && (
            <span key={i} style={{ left: `${(i / (data.length - 1)) * 100}%` }}>{d.label || d.time}</span>
          ))}
        </div>
        
        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 h-[{height}px] flex flex-col justify-between pr-2 text-xs text-gray-500 dark:text-gray-400 pointer-events-none">
          {[maxValue, maxValue * 0.75, maxValue * 0.5, maxValue * 0.25, minValue].map((v, i) => (
            <span key={i} className="text-right">{v.toFixed(0)}</span>
          ))}
        </div>
      </div>
    </div>
  );
}