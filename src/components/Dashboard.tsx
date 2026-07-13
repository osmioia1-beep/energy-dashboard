import { useState, useRef } from 'react';
import { useEnergyData, type TimeRange, formatEnergy, formatCost, formatPct } from '../hooks/useEnergyData';
import { PowerCard } from './PowerCard';

const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: 'today', label: 'Hoje' },
  { value: 'yesterday', label: 'Ontem' },
  { value: '24h', label: '24h' },
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
  { value: 'total', label: 'Total' },
];

const SERIES_COLORS = {
  grid: '#3b82f6',
  solar: '#fbbf24',
};

function getChartConfig(timeRange: TimeRange, isHourlyView: boolean) {
  if (isHourlyView) {
    return {
      title: timeRange === 'today' ? 'Energia (Hoje)' : timeRange === 'yesterday' ? 'Energia (Ontem)' : 'Energia (Últimas 24h)',
      periodTitle: timeRange === 'today' ? 'Hoje' : timeRange === 'yesterday' ? 'Ontem' : 'Últimas 24h',
      maxPoints: 24,
    };
  }
  switch (timeRange) {
    case '7d':
      return { title: 'Energia (7 dias)', periodTitle: 'Últimos 7 dias', maxPoints: 7 };
    case '30d':
      return { title: 'Energia (30 dias)', periodTitle: 'Últimos 30 dias', maxPoints: 30 };
    case 'total':
      return { title: 'Energia (Mensal)', periodTitle: 'Todo o histórico (Mensal)', maxPoints: 12 };
    default:
      return { title: 'Energia (Diário)', periodTitle: 'Últimos 30 dias', maxPoints: 30 };
  }
}

function getSummaryTitle(timeRange: TimeRange): string {
  const labels: Record<TimeRange, string> = {
    today: 'Hoje',
    yesterday: 'Ontem',
    '24h': 'Últimas 24h',
    '7d': 'Últimos 7 dias',
    '30d': 'Últimos 30 dias',
    total: 'Todo o histórico',
  };
  return labels[timeRange] || 'Período';
}

function getDailyChartData(
  dailyData: { device_id: string; bucket: string; energy_wh: number | null }[],
  deviceId: string,
  timeRange: TimeRange
) {
  const filtered = dailyData.filter(d => d.device_id === deviceId);
  let sliced: typeof filtered;
  let dateFormat: Intl.DateTimeFormatOptions;
  switch (timeRange) {
    case 'today':
    case 'yesterday':
    case '24h':
      sliced = filtered.slice(0, 1);
      dateFormat = { weekday: 'short', day: '2-digit', month: '2-digit' };
      break;
    case '7d':
      sliced = filtered.slice(0, 7);
      dateFormat = { weekday: 'short', day: '2-digit', month: '2-digit' };
      break;
    case '30d':
      sliced = filtered.slice(0, 30);
      dateFormat = { weekday: 'short', day: '2-digit', month: '2-digit' };
      break;
    case 'total':
      sliced = filtered.slice(0, 365);
      dateFormat = { month: 'short', year: '2-digit' };
      break;
    default:
      sliced = filtered.slice(0, 30);
      dateFormat = { weekday: 'short', day: '2-digit', month: '2-digit' };
  }
  return sliced.reverse().map(d => ({
    time: new Date(d.bucket).toLocaleDateString('pt-PT', dateFormat),
    value: d.energy_wh || 0,
    label: new Date(d.bucket).toLocaleDateString('pt-PT', dateFormat),
  }));
}

interface ChartDataPoint {
  time: string;
  value: number;
  label?: string;
}

interface CombinedEnergyChartProps {
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

function CombinedEnergyChart({ gridData, solarData, title, height = 280, yAxisLabel }: CombinedEnergyChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [showGrid, setShowGrid] = useState(true);
  const [showSolar, setShowSolar] = useState(true);
  const svgRef = useRef<SVGSVGElement>(null);

  // Prepare data
  const visibleGridData = showGrid ? gridData : [];
  const visibleSolarData = showSolar ? solarData : [];

  // Determine combined data range
  const allValues = [
    ...visibleGridData.map(d => d.value),
    ...visibleSolarData.map(d => d.value),
  ];
  const maxValue = allValues.length > 0 ? Math.max(...allValues) : 1;
  const minValue = Math.min(0, ...allValues);
  const range = maxValue - minValue || 1;

  // X scale - align by time labels
  const labels = Array.from(new Set([
    ...visibleGridData.map(d => d.label || d.time),
    ...visibleSolarData.map(d => d.label || d.time),
  ])).sort();
  
  const dataLength = labels.length;
  const padding = { top: 30, right: 20, bottom: 50, left: 80 };
  const chartHeight = height - padding.top - padding.bottom;
  const chartWidth = 600 - padding.left - padding.right;

  const xScale = (i: number) => padding.left + (i / (dataLength - 1)) * chartWidth;
  const yScale = (value: number) => padding.top + chartHeight - ((value - minValue) / range) * chartHeight;

  // Convert series data to points aligned with labels
  const getPoints = (data: ChartDataPoint[], color: string) => 
    labels.map((label, i) => {
      const point = data.find(d => (d.label || d.time) === label);
      return {
        x: xScale(i),
        y: yScale(point?.value || 0),
        value: point?.value || 0,
        hasData: !!point,
        color,
      };
    });

  const gridPoints = getPoints(visibleGridData, SERIES_COLORS.grid);
  const solarPoints = getPoints(visibleSolarData, SERIES_COLORS.solar);

  // Build paths
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

  // Combine all points for hover detection
  const allPoints = [...gridPoints, ...solarPoints].sort((a, b) => a.x - b.x);

  // Hover state
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
                    {labels[hoverIndex]}
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
            <span key={i} style={{ left: `${(i / (labels.length - 1)) * 100}%` }}>{label}</span>
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

export function Dashboard() {
  const {
    hourlyData,
    dailyData,
    totals,
    loading,
    error,
    timeRange,
    setTimeRange,
    refetch,
  } = useEnergyData('24h');

  // Latest values for real-time cards
  const latestGrid = hourlyData.find(d => d.device_id === 'quadro_principal');
  const latestSolar = hourlyData.find(d => d.device_id === 'inversor');

  const gridPower = latestGrid?.avg_power_w || 0;
  const solarPower = latestSolar?.avg_power_w || 0;
  const housePower = gridPower + solarPower;
  const exportPower = gridPower < 0 ? Math.abs(gridPower) : 0;
  const importPower = gridPower > 0 ? gridPower : 0;

  // Chart configuration
  const isHourlyView = timeRange === 'today' || timeRange === 'yesterday' || timeRange === '24h';
  const chartConfig = getChartConfig(timeRange, isHourlyView);
  const summaryTitle = getSummaryTitle(timeRange);

  // Chart data preparation
  const gridChartData = isHourlyView
    ? hourlyData
        .filter(d => d.device_id === 'quadro_principal')
        .slice(0, 24)
        .reverse()
        .map(d => ({
          time: new Date(d.bucket).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }),
          value: d.energy_wh || 0,
          label: new Date(d.bucket).toLocaleTimeString('pt-PT', { hour: '2-digit' }),
        }))
    : getDailyChartData(dailyData, 'quadro_principal', timeRange);

  const solarChartData = isHourlyView
    ? hourlyData
        .filter(d => d.device_id === 'inversor')
        .slice(0, 24)
        .reverse()
        .map(d => ({
          time: new Date(d.bucket).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }),
          value: d.energy_wh || 0,
          label: new Date(d.bucket).toLocaleTimeString('pt-PT', { hour: '2-digit' }),
        }))
    : getDailyChartData(dailyData, 'inversor', timeRange);

  // Period summary chart (always daily view, adapts to timeRange)
  const periodChartData = getDailyChartData(dailyData, 'quadro_principal', timeRange);

  if (loading && !hourlyData.length) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6">
        <h3 className="text-red-800 dark:text-red-300 font-semibold mb-2">Erro ao carregar dados</h3>
        <p className="text-red-600 dark:text-red-400">{error}</p>
        <button onClick={refetch} className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition">
          Tentar novamente
        </button>
      </div>
    );
  }

  // Format totals for display
  const solarTotal = formatEnergy(totals.solar_wh);
  const houseTotal = formatEnergy(totals.house_wh);
  const exportTotal = formatEnergy(totals.export_wh);
  const importTotal = formatEnergy(totals.import_wh);

  return (
    <div className="space-y-6">
      {/* Header with time range selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary">Dashboard de Energia</h1>
          <p className="text-secondary mt-1">Monitorização em tempo real - Solar + Rede</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {TIME_RANGES.map(range => (
            <button
              key={range.value}
              onClick={() => setTimeRange(range.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                timeRange === range.value
                  ? 'bg-primary text-white'
                  : 'bg-tertiary text-secondary hover:bg-border-hover'
              }`}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      {/* Power Cards Grid - Real Time */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <PowerCard
          label="Produção Solar"
          value={solarPower}
          unit="W"
          color="text-amber-500"
          icon="☀️"
        />
        <PowerCard
          label="Rede Elétrica"
          value={gridPower}
          unit="W"
          color={gridPower < 0 ? 'text-green-500' : 'text-orange-500'}
          icon="⚡"
        />
        <PowerCard
          label="Consumo Casa"
          value={housePower}
          unit="W"
          color="text-red-500"
          icon="🏠"
        />
        <PowerCard
          label={exportPower > 0 ? 'Exportando' : 'Importando'}
          value={exportPower > 0 ? exportPower : importPower}
          unit="W"
          color={exportPower > 0 ? 'text-green-500' : 'text-orange-500'}
          icon={exportPower > 0 ? '📤' : '📥'}
        />
      </div>

      {/* Period Total Cards - Dynamic based on timeRange */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <PowerCard
          label={`Solar (${TIME_RANGES.find(r => r.value === timeRange)?.label})`}
          value={totals.solar_wh}
          unit="Wh"
          color="text-amber-500"
          icon="☀️"
        />
        <PowerCard
          label={`Rede (${TIME_RANGES.find(r => r.value === timeRange)?.label})`}
          value={totals.grid_wh}
          unit="Wh"
          color="text-blue-500"
          icon="⚡"
        />
        <PowerCard
          label={`Custo (${TIME_RANGES.find(r => r.value === timeRange)?.label})`}
          value={totals.cost_eur}
          unit="€"
          color="text-orange-500"
          icon="💰"
        />
        <PowerCard
          label={`Autoconsumo (${TIME_RANGES.find(r => r.value === timeRange)?.label})`}
          value={totals.autoconsumo_pct}
          unit="%"
          color="text-green-500"
          icon="♻️"
        />
      </div>

      {/* Charts - Combined Grid + Solar */}
      <div className="space-y-6">
        <CombinedEnergyChart
          gridData={gridChartData}
          solarData={solarChartData}
          title={chartConfig.title}
          yAxisLabel="Energia (kWh)"
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <CombinedEnergyChart
            gridData={periodChartData}
            solarData={getDailyChartData(dailyData, 'inversor', timeRange)}
            title={`Energia Diária (${chartConfig.periodTitle})`}
            yAxisLabel="Energia (kWh)"
          />
          <div className="bg-secondary rounded-xl p-5 shadow-card border border-color">
            <h3 className="text-lg font-semibold text-primary mb-4">
              Resumo do Período ({summaryTitle})
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-secondary">Total Consumo Casa</span>
                <span className="font-medium">{houseTotal.value.toFixed(2)} {houseTotal.unit}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-secondary">Total Produção Solar</span>
                <span className="font-medium">{solarTotal.value.toFixed(2)} {solarTotal.unit}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-secondary">Exportado para Rede</span>
                <span className="font-medium text-green-500">{exportTotal.value.toFixed(2)} {exportTotal.unit}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-secondary">Importado da Rede</span>
                <span className="font-medium text-orange-500">{importTotal.value.toFixed(2)} {importTotal.unit}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-secondary">Custo Estimado</span>
                <span className="font-medium">{formatCost(totals.cost_eur)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-secondary">Autoconsumo</span>
                <span className="font-medium text-green-500">{formatPct(totals.autoconsumo_pct)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-secondary">Autossuficiência</span>
                <span className="font-medium text-green-500">
                  {totals.solar_wh > 0 
                    ? formatPct(Math.min(100, (totals.solar_wh - totals.export_wh) / totals.solar_wh * 100))
                    : '0%'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Last updated */}
      <div className="text-xs text-secondary text-center">
        Atualizado: {new Date().toLocaleString('pt-PT')} | Próxima atualização automática em 60s
      </div>
    </div>
  );
}