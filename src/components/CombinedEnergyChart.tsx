import { useState, useRef, useMemo } from 'react';

const SERIES_COLORS = {
  grid: '#3b82f6',
  solar: '#fbbf24',
};

export interface ChartDataPoint {
  time: string;
  value: number;
  label?: string;
}

export interface CombinedEnergyChartProps {
  gridData: ChartDataPoint[];
  solarData: ChartDataPoint[];
  title: string;
  height?: number;
  yAxisLabel?: string;
}

function formatValue(value: number, unit: string): string {
  if (unit === 'Wh' || unit === 'kWh') {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)} MWh`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(2)} kWh`;
    return `${value.toFixed(0)} Wh`;
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

function parseLabelToDate(label: string): number {
  const formats = [
    /^(\w{3})\s+(\d{2})\/(\d{2})$/,
    /^(\d{4})-(\d{2})-(\d{2})$/,
    /^(\d{2})\/(\d{2})\/(\d{4})$/,
    /^(\w{3})\s+(\d{2})$/,
  ];
  
  for (const regex of formats) {
    const match = label.match(regex);
    if (match) {
      if (regex === formats[0]) {
        const [, , day, month] = match;
        const year = new Date().getFullYear();
        return new Date(year, parseInt(month) - 1, parseInt(day)).getTime();
      }
      if (regex === formats[1]) {
        const [, year, month, day] = match;
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day)).getTime();
      }
      if (regex === formats[2]) {
        const [, day, month, year] = match;
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day)).getTime();
      }
      if (regex === formats[3]) {
              const [, monthStr, yearStr] = match;
              const monthMap: Record<string, number> = {
                'Jan': 0, 'Fev': 1, 'Mar': 2, 'Abr': 3, 'Mai': 4, 'Jun': 5,
                'Jul': 6, 'Ago': 7, 'Set': 8, 'Out': 9, 'Nov': 10, 'Dez': 11,
                'Feb': 1, 'Apr': 3, 'May': 4, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Dec': 11,
              };
              const month = monthMap[monthStr];
              if (month !== undefined) {
                const year = parseInt(yearStr) + 2000;
                return new Date(year, month).getTime();
              }
            }
    }
  }
  const isoDate = new Date(label).getTime();
  return isNaN(isoDate) ? 0 : isoDate;
}

export function CombinedEnergyChart({ gridData, solarData, title, height = 280, yAxisLabel }: CombinedEnergyChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [showGrid, setShowGrid] = useState(true);
  const [showSolar, setShowSolar] = useState(true);
  const svgRef = useRef<SVGSVGElement>(null);

  const visibleGridData = showGrid ? gridData : [];
  const visibleSolarData = showSolar ? solarData : [];

  // Create a combined map of all data points keyed by label/time
  const dataMap = useMemo(() => {
    const map = new Map<string, { grid?: ChartDataPoint; solar?: ChartDataPoint }>();
    
    [...visibleGridData, ...visibleSolarData].forEach(d => {
      const key = d.label || d.time;
      const existing = map.get(key) || { grid: undefined, solar: undefined };
      if (visibleGridData.some(g => (g.label || g.time) === key)) {
        existing.grid = visibleGridData.find(g => (g.label || g.time) === key);
      }
      if (visibleSolarData.some(s => (s.label || s.time) === key)) {
        existing.solar = visibleSolarData.find(s => (s.label || s.time) === key);
      }
      map.set(key, existing);
    });
    return map;
  }, [visibleGridData, visibleSolarData]);

  // Sort labels chronologically using date parsing
  const labels = useMemo(() => 
    Array.from(dataMap.keys()).sort((a, b) => parseLabelToDate(a) - parseLabelToDate(b)),
  [dataMap]);

  const allValues = useMemo(() => labels.flatMap(label => {
    const entry = dataMap.get(label);
    return [entry?.grid?.value ?? 0, entry?.solar?.value ?? 0];
  }), [labels, dataMap]);

  const maxValue = allValues.length > 0 ? Math.max(...allValues, 0) : 1;
  const minValue = Math.min(0, ...allValues);
  const range = maxValue - minValue || 1;

  const dataLength = labels.length;
  const padding = { top: 30, right: 20, bottom: 50, left: 80 };
  const chartHeight = height - padding.top - padding.bottom;
  const chartWidth = 600 - padding.left - padding.right;

  // Handle single data point case
  const xScale = dataLength <= 1 
    ? () => padding.left + chartWidth / 2
    : (i: number) => padding.left + (i / (dataLength - 1)) * chartWidth;
    
  const yScale = (value: number) => padding.top + chartHeight - ((value - minValue) / range) * chartHeight;

  const getPoints = useMemo(() => (data: ChartDataPoint[], color: string) =>
    labels.map((label, i) => {
      const point = data.find(d => (d.label || d.time) === label);
      return {
        x: xScale(i),
        y: yScale(point?.value || 0),
        value: point?.value || 0,
        hasData: !!point,
        color,
        label,
      };
    }), [labels, xScale, yScale]);

  const gridPoints = getPoints(visibleGridData, SERIES_COLORS.grid);
  const solarPoints = getPoints(visibleSolarData, SERIES_COLORS.solar);

  const buildPath = (points: typeof gridPoints) => {
    const validPoints = points.filter(p => p.hasData);
    if (validPoints.length < 2) return '';
    return validPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  };

  const buildAreaPath = (points: typeof gridPoints) => {
    const validPoints = points.filter(p => p.hasData);
    if (validPoints.length === 0) return '';
    const first = validPoints[0];
    const last = validPoints[validPoints.length - 1];
    return [
      `M ${first.x},${padding.top + chartHeight}`,
      ...validPoints.map((p, i) => `${i === 0 ? '' : 'L'} ${p.x},${p.y}`),
      `L ${last.x},${padding.top + chartHeight}`,
      'Z'
    ].join(' ');
  };

  const gridPath = buildPath(gridPoints);
  const solarPath = buildPath(solarPoints);
  const gridAreaPath = buildAreaPath(gridPoints);
  const solarAreaPath = buildAreaPath(solarPoints);

  const yTicks = getYAxisTicks(maxValue, minValue, 'Wh');

  const allPoints = [...gridPoints, ...solarPoints].sort((a, b) => a.x - b.x);

  const showTooltip = hoverIndex !== null && (showGrid || showSolar);
  const hoveredPoint = showTooltip ? allPoints[hoverIndex] : null;

  return (
    <div className="bg-secondary rounded-xl p-5 shadow-card border border-color">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-primary">{title}</h3>
        {yAxisLabel && <span className="text-xs text-secondary">{yAxisLabel}</span>}
      </div>

      <div className="relative" style={{ height: `${height}px`, width: '100%' }}>
        <svg 
          ref={svgRef}
          width="100%" 
          height={height} 
          viewBox={`0 0 600 ${height}`} 
          preserveAspectRatio="none"
          onMouseMove={(e) => {
            if (!svgRef.current) return;
            const rect = svgRef.current.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const closestIndex = allPoints.reduce((closest, point, index) => {
              const dist = Math.abs(point.x - mouseX);
              const closestDist = Math.abs(allPoints[closest].x - mouseX);
              return dist < closestDist ? index : closest;
            }, 0);
            setHoverIndex(closestIndex);
          }}
          onMouseLeave={() => setHoverIndex(null)}
          style={{ cursor: 'crosshair', width: '100%', height: `${height}px` }}
        >
          <defs>
            {showGrid && (
              <linearGradient id="gridAreaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={SERIES_COLORS.grid} stopOpacity="0.2" />
                <stop offset="100%" stopColor={SERIES_COLORS.grid} stopOpacity="0" />
              </linearGradient>
            )}
            {showSolar && (
              <linearGradient id="solarAreaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={SERIES_COLORS.solar} stopOpacity="0.2" />
                <stop offset="100%" stopColor={SERIES_COLORS.solar} stopOpacity="0" />
              </linearGradient>
            )}
          </defs>
          
          {/* Y-axis grid lines */}
          {yTicks.map((tick, i) => (
            <line
              key={i}
              x1={padding.left}
              y1={yScale(tick.value)}
              x2={padding.left + chartWidth}
              y2={yScale(tick.value)}
              stroke="var(--chart-grid)"
              strokeWidth="0.5"
            />
          ))}
          
          {/* X-axis grid lines */}
          {labels.map((_, i) => i % Math.max(1, Math.ceil(labels.length / 6)) === 0 && (
            <line
              key={`vgrid-${i}`}
              x1={xScale(i)}
              y1={padding.top}
              x2={xScale(i)}
              y2={padding.top + chartHeight}
              stroke="var(--chart-grid)"
              strokeWidth="0.5"
              strokeDasharray="2,4"
            />
          ))}
          
          {/* Grid Area */}
          {showGrid && gridAreaPath && (
            <path d={gridAreaPath} fill="url(#gridAreaGradient)" stroke="none" />
          )}
          
          {/* Solar Area */}
          {showSolar && solarAreaPath && (
            <path d={solarAreaPath} fill="url(#solarAreaGradient)" stroke="none" />
          )}
          
          {/* Grid Line */}
          {showGrid && gridPath && (
            <path d={gridPath} stroke={SERIES_COLORS.grid} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          )}
          
          {/* Solar Line */}
          {showSolar && solarPath && (
            <path d={solarPath} stroke={SERIES_COLORS.solar} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          )}
          
          {/* Grid Points */}
          {showGrid && gridPoints.map((p, i) => (
            <circle
              key={`grid-${i}`}
              cx={p.x}
              cy={p.y}
              r={hoverIndex === i ? 6 : 4}
              fill={SERIES_COLORS.grid}
              stroke="var(--bg-secondary)"
              strokeWidth={hoverIndex === i ? 3 : 2}
              style={{ cursor: 'crosshair', transition: 'r 0.15s ease' }}
            />
          ))}
          
          {/* Solar Points */}
          {showSolar && solarPoints.map((p, i) => {
            const globalIndex = gridPoints.length + i;
            return (
              <circle
                key={`solar-${i}`}
                cx={p.x}
                cy={p.y}
                r={hoverIndex === globalIndex ? 6 : 4}
                fill={SERIES_COLORS.solar}
                stroke="var(--bg-secondary)"
                strokeWidth={hoverIndex === globalIndex ? 3 : 2}
                style={{ cursor: 'crosshair', transition: 'r 0.15s ease' }}
              />
            );
          })}
          
          {/* Hover vertical line */}
          {showTooltip && (
            <line
              x1={allPoints[hoverIndex!].x}
              y1={padding.top}
              x2={allPoints[hoverIndex!].x}
              y2={padding.top + chartHeight}
              stroke="var(--chart-text)"
              strokeWidth="1"
              strokeDasharray="4,4"
              opacity="0.6"
            />
          )}
          
          {/* Tooltip */}
          {showTooltip && hoveredPoint && (
            <g>
              <foreignObject 
                x={hoveredPoint.x - 140} 
                y={hoveredPoint.y - 100} 
                width={280} 
                height={100}
                style={{ pointerEvents: 'none' }}
              >
                <div style={{ 
                  background: 'var(--bg-secondary)', 
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  boxShadow: 'var(--card-shadow)',
                  fontSize: '13px',
                  lineHeight: '1.5',
                }}>
                  <div style={{ fontWeight: '600', marginBottom: '6px', color: 'var(--text-primary)' }}>
                    {hoveredPoint.label}
                  </div>
                  {hoveredPoint.color === SERIES_COLORS.grid && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '3px 0' }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: SERIES_COLORS.grid }}></span>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Rede</span>
                      <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{formatValue(hoveredPoint.value, 'Wh')}</span>
                    </div>
                  )}
                  {hoveredPoint.color === SERIES_COLORS.solar && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '3px 0' }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: SERIES_COLORS.solar }}></span>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Solar</span>
                      <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{formatValue(hoveredPoint.value, 'Wh')}</span>
                    </div>
                  )}
                </div>
              </foreignObject>
            </g>
          )}
        </svg>
        
        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 h-full flex flex-col justify-between pr-2 text-xs text-secondary pointer-events-none" style={{ height: `${height}px` }}>
          {yTicks.map((tick, i) => (
            <span key={i} className="text-right" style={{ top: `${yScale(tick.value)}px`, transform: 'translateY(-50%)' }}>
              {tick.label}
            </span>
          ))}
        </div>

        {/* X-axis labels */}
        <div className="absolute bottom-0 left-0 right-0 flex justify-between px-2 mt-2 text-xs text-secondary" style={{ paddingLeft: `${padding.left}px`, paddingRight: `${padding.right}px` }}>
          {labels.map((label, i) => i % Math.max(1, Math.ceil(labels.length / 8)) === 0 && (
            <span key={i} style={{ left: `${(i / (dataLength - 1)) * 100}%` }}>{label}</span>
          ))}
        </div>
      </div>

      {/* Legend / Series toggles */}
      <div className="chart-legend mt-4 pt-4 border-t border-color">
        <button
          onClick={() => setShowGrid(!showGrid)}
          className="chart-legend-item"
          style={{ opacity: showGrid ? 1 : 0.4 }}
        >
          <span className="chart-legend-color" style={{ backgroundColor: SERIES_COLORS.grid }}></span>
          <span>Rede Elétrica</span>
        </button>
        <button
          onClick={() => setShowSolar(!showSolar)}
          className="chart-legend-item"
          style={{ opacity: showSolar ? 1 : 0.4 }}
        >
          <span className="chart-legend-color" style={{ backgroundColor: SERIES_COLORS.solar }}></span>
          <span>Produção Solar</span>
        </button>
      </div>
    </div>
  );
}