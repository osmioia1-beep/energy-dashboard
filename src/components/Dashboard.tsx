import { useEnergyData, type TimeRange, formatEnergy, formatCost, formatPct } from '../hooks/useEnergyData';
import { PowerCard } from './PowerCard';
import { CombinedEnergyChart } from './CombinedEnergyChart';

const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: 'today', label: 'Hoje' },
  { value: 'yesterday', label: 'Ontem' },
  { value: '24h', label: '24h' },
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
  { value: 'total', label: 'Total' },
];

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
  // Sort by date ascending FIRST
  const sorted = filtered.sort((a, b) => new Date(a.bucket).getTime() - new Date(b.bucket).getTime());
  
  let sliced: typeof sorted;
  let dateFormat: Intl.DateTimeFormatOptions;
  switch (timeRange) {
    case 'today':
    case 'yesterday':
    case '24h':
      sliced = sorted.slice(-1); // last day
      dateFormat = { weekday: 'short', day: '2-digit', month: '2-digit' };
      break;
    case '7d':
      sliced = sorted.slice(-7);
      dateFormat = { weekday: 'short', day: '2-digit', month: '2-digit' };
      break;
    case '30d':
      sliced = sorted.slice(-30);
      dateFormat = { weekday: 'short', day: '2-digit', month: '2-digit' };
      break;
    case 'total':
      sliced = sorted.slice(-365);
      dateFormat = { month: 'short', year: '2-digit' };
      break;
    default:
      sliced = sorted.slice(-30);
      dateFormat = { weekday: 'short', day: '2-digit', month: '2-digit' };
  }
  // Return in chronological order (oldest first) for chart
  return sliced.map(d => ({
    time: new Date(d.bucket).toLocaleDateString('pt-PT', dateFormat),
    value: d.energy_wh || 0,
    label: new Date(d.bucket).toLocaleDateString('pt-PT', dateFormat),
    bucket: d.bucket, // preserve original bucket for sorting
  }));
}

function getHourlyChartData(
  hourlyData: { device_id: string; bucket: string; energy_wh: number | null; avg_power_w: number | null }[],
  deviceId: string,
  timeRange: TimeRange
) {
  const filtered = hourlyData.filter(d => d.device_id === deviceId);
  // Sort by bucket ascending (oldest first)
  const sorted = filtered.sort((a, b) => new Date(a.bucket).getTime() - new Date(b.bucket).getTime());
  
  let sliced: typeof sorted;
  let timeFormat: Intl.DateTimeFormatOptions;
  
  switch (timeRange) {
    case 'today':
      // Today: from midnight to now (or last available hour)
      sliced = sorted.slice(-24); // last 24 hours, but today only has hours from 00:00
      timeFormat = { hour: '2-digit', minute: '2-digit' };
      break;
    case 'yesterday':
      // Yesterday: full 24h
      sliced = sorted.slice(-24);
      timeFormat = { hour: '2-digit', minute: '2-digit' };
      break;
    case '24h':
      // Last 24 hours: from current hour yesterday to current hour today
      sliced = sorted.slice(-24);
      timeFormat = { hour: '2-digit', minute: '2-digit' };
      break;
    default:
      sliced = sorted.slice(-24);
      timeFormat = { hour: '2-digit', minute: '2-digit' };
  }
  
  return sliced.map(d => ({
    time: new Date(d.bucket).toLocaleTimeString('pt-PT', timeFormat),
    value: d.energy_wh || 0,
    label: new Date(d.bucket).toLocaleTimeString('pt-PT', { hour: '2-digit' }),
    bucket: d.bucket, // preserve for sorting
  }));
}

export function Dashboard() {
  const {
    hourlyData,
    dailyData,
    totals,
    realTime,
    loading,
    error,
    timeRange,
    setTimeRange,
    refetch,
  } = useEnergyData('24h');

  // Tempo Real: usa o objeto realTime do hook (dados não filtrados)
  const { solarPower, gridPower, housePower } = realTime;

  const isHourlyView = timeRange === 'today' || timeRange === 'yesterday' || timeRange === '24h';
  const chartConfig = getChartConfig(timeRange, isHourlyView);
  const summaryTitle = getSummaryTitle(timeRange);

  // Chart data preparation
  const gridChartData = isHourlyView
    ? getHourlyChartData(hourlyData, 'quadro_principal', timeRange)
    : getDailyChartData(dailyData, 'quadro_principal', timeRange);

  const solarChartData = isHourlyView
    ? getHourlyChartData(hourlyData, 'inversor', timeRange)
    : getDailyChartData(dailyData, 'inversor', timeRange);

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

  const solarTotal = formatEnergy(totals.solar_wh);
  const houseTotal = formatEnergy(totals.house_wh);
  const exportTotal = formatEnergy(totals.export_wh);
  const importTotal = formatEnergy(totals.import_wh);

  return (
    <div className="space-y-6 p-4">
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

      {/* Power Cards Grid - Tempo Real */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-secondary uppercase tracking-wide">Tempo Real</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
        </div>
      </div>

      {/* Period Total Cards - Totais do Período */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-secondary uppercase tracking-wide">Totais do Período</h3>
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
      </div>

      {/* Charts - Combined Grid + Solar */}
      <div className="space-y-6">
        <CombinedEnergyChart
          gridData={gridChartData}
          solarData={solarChartData}
          title={chartConfig.title}
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

      {/* Last updated */}
      <div className="text-xs text-secondary text-center">
        Atualizado: {new Date().toLocaleString('pt-PT')} | Próxima atualização automática em 60s
      </div>
    </div>
  );
}