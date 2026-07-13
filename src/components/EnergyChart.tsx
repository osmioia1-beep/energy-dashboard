import { useState, useRef } from 'react';

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

export function EnergyChart({ data, title, color, unit, yAxisLabel, height = 280 }: EnergyChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [visible, setVisible] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  if (!data.length) {
    return (
      <div className="bg-secondary rounded-xl p-6 shadow-card border border-color h-[280px] flex items-center justify-center">
        <span className="text-secondary">Sem dados disponíveis</span>
      </div>
    );
  }

  const maxValue = Math.max(...data.map(d => d.value));
  const minValue = Math.min(...data.map(d => d.value));
  const range = maxValue - minValue || 1;
  const padding = { top: 30, right: 20, bottom: 50, left: 80 };
  const chartHeight = height - padding.top - padding.bottom;
  const chartWidth = 600 - padding.left - padding.right;

  const xScale = (i: number) => padding.left + (i / (data.length - 1)) * chartWidth;
  const yScale = (value: number) => padding.top + chartHeight - ((value - minValue) / range) * chartHeight;

  const points = data.map((d, i) => ({ x: xScale(i), y: yScale(d.value), value: d.value }));
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const areaPath = `${points[0].x},${padding.top + chartHeight} ${path} ${points[points.length - 1].x},${padding.top + chartHeight} Z`;

  const yTicks = getYAxisTicks(maxValue, minValue, unit);
  const showTooltip = hoverIndex !== null && visible;
  const tooltipPoint = showTooltip ? points[hoverIndex] : null;
  const tooltipData = showTooltip ? data[hoverIndex] : null;

  const exportToPNG = () => {
    if (!svgRef.current || !containerRef.current) return;
    
    const svg = svgRef.current.cloneNode(true) as SVGSVGElement;
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const bgColor = getComputedStyle(document.documentElement).getPropertyValue('--bg-secondary') || '#fff';
    svg.style.backgroundColor = bgColor;
    
    // Add title
    const titleEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    titleEl.setAttribute('x', '300');
    titleEl.setAttribute('y', '20');
    titleEl.setAttribute('text-anchor', 'middle');
    titleEl.setAttribute('font-size', '16');
    titleEl.setAttribute('font-weight', 'bold');
    titleEl.setAttribute('fill', getComputedStyle(document.documentElement).getPropertyValue('--text-primary') || '#111');
    titleEl.textContent = title;
    svg.insertBefore(titleEl, svg.firstChild);

    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svg);
    const blob = new Blob([svgString], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 600;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        
        canvas.toBlob((pngBlob) => {
          if (pngBlob) {
            const pngUrl = URL.createObjectURL(pngBlob);
            const a = document.createElement('a');
            a.href = pngUrl;
            a.download = `${title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.png`;
            a.click();
            URL.revokeObjectURL(pngUrl);
          }
        }, 'image/png');
      }
    };
    img.src = url;
  };

  return (
    <div className="bg-secondary rounded-xl p-5 shadow-card border border-color chart-wrapper" ref={containerRef}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-primary">{title}</h3>
          {yAxisLabel && <span className="text-xs text-secondary">{yAxisLabel}</span>}
        </div>
        <button
          onClick={exportToPNG}
          className="chart-export-btn"
          title="Exportar como PNG"
          aria-label="Exportar gráfico como PNG"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          <span>PNG</span>
        </button>
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
            const closestIndex = points.reduce((closest, point, index) => {
              const dist = Math.abs(point.x - mouseX);
              const closestDist = Math.abs(points[closest].x - mouseX);
              return dist < closestDist ? index : closest;
            }, 0);
            setHoverIndex(closestIndex);
          }}
          onMouseLeave={() => setHoverIndex(null)}
        >
          <defs>
            <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.25" />
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
              stroke="var(--chart-grid)"
              strokeWidth="0.5"
            />
          ))}
          
          {/* X-axis grid lines (vertical) */}
          {data.map((_, i) => i % Math.max(1, Math.ceil(data.length / 6)) === 0 && (
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
          
          {/* Area under curve */}
          {visible && (
            <path
              d={areaPath}
              fill="url(#areaGradient)"
              stroke="none"
            />
          )}
          
          {/* Line */}
          {visible && (
            <path
              d={path}
              stroke={color}
              strokeWidth="2.5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="drop-shadow(0 1px 2px rgba(0,0,0,0.1))"
            />
          )}
          
          {/* Data points */}
          {visible && points.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={hoverIndex === i ? 6 : 4}
              fill={color}
              stroke="var(--bg-secondary)"
              strokeWidth={hoverIndex === i ? 3 : 2}
              style={{ 
                cursor: 'crosshair',
                transition: 'r 0.15s ease, stroke-width 0.15s ease'
              }}
            />
          ))}

          {/* Hover vertical line */}
          {showTooltip && (
            <line
              x1={tooltipPoint!.x}
              y1={padding.top}
              x2={tooltipPoint!.x}
              y2={padding.top + chartHeight}
              stroke="var(--chart-text)"
              strokeWidth="1"
              strokeDasharray="4,4"
              opacity="0.6"
            />
          )}

          {/* Tooltip */}
          {showTooltip && tooltipData && (
            <g>
              <foreignObject 
                x={tooltipPoint!.x - 120} 
                y={tooltipPoint!.y - 80} 
                width={240} 
                height={80}
                style={{ pointerEvents: 'none' }}
              >
                <div className="chart-tooltip" style={{ 
                  background: 'var(--bg-secondary)', 
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)'
                }}>
                  <div className="tooltip-row" style={{ fontWeight: '600', marginBottom: '4px', color: 'var(--text-primary)' }}>
                    {tooltipData.label || tooltipData.time}
                  </div>
                  <div className="tooltip-row">
                    <span className="tooltip-color" style={{ backgroundColor: color }}></span>
                    <span className="tooltip-label">Valor</span>
                    <span className="tooltip-value">{formatValue(tooltipData.value, unit)}</span>
                  </div>
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
          {data.map((d, i) => i % Math.max(1, Math.ceil(data.length / 8)) === 0 && (
            <span key={i} style={{ left: `${(i / (data.length - 1)) * 100}%` }}>{d.label || d.time}</span>
          ))}
        </div>
      </div>

      {/* Legend / Series toggle */}
      <div className="chart-legend mt-4 pt-4 border-t border-color">
        <button
          onClick={() => setVisible(!visible)}
          className="chart-legend-item"
          style={{ opacity: visible ? 1 : 0.4 }}
        >
          <span className="chart-legend-color" style={{ backgroundColor: color }}></span>
          <span>{title}</span>
        </button>
      </div>
    </div>
  );
}