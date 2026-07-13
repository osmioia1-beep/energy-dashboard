import { useEnergyData, type TimeRange, formatEnergy, formatCost, formatPct } from '../hooks/useEnergyData';
import { PowerCard } from './PowerCard';
import { EnergyChart } from './EnergyChart';

const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: 'today', label: 'Hoje' },
  { value: '24h', label: '24h' },
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
  { value: 'total', label: 'Total' },
];

function getChartConfig(timeRange: TimeRange, isHourlyView: boolean) {
  if (isHourlyView) {
    return {
      gridTitle: 'Rede Elétrica (Horário)',
      solarTitle: 'Produção Solar (Horário)',
      periodTitle: 'Últimas 24h',
      maxPoints: 24,
    };
  }
  switch (timeRange) {
    case '7d':
      return {
        gridTitle: 'Rede Elétrica (7 dias)',
        solarTitle: 'Produção Solar (7 dias)',
        periodTitle: 'Últimos 7 dias',
        maxPoints: 7,
      };
    case '30d':
      return {
        gridTitle: 'Rede Elétrica (30 dias)',
        solarTitle: 'Produção Solar (30 dias)',
        periodTitle: 'Últimos 30 dias',
        maxPoints: 30,
      };
    case 'total':
      return {
        gridTitle: 'Rede Elétrica (Mensal)',
        solarTitle: 'Produção Solar (Mensal)',
        periodTitle: 'Todo o histórico (Mensal)',
        maxPoints: 12,
      };
    default: // 24h fallback
      return {
        gridTitle: 'Rede Elétrica (Diário)',
        solarTitle: 'Produção Solar (Diário)',
        periodTitle: 'Últimos 30 dias',
        maxPoints: 30,
      };
  }
}

function getSummaryTitle(timeRange: TimeRange): string {
  const labels: Record<TimeRange, string> = {
    today: 'Hoje',
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
  const isHourlyView = timeRange === 'today' || timeRange === '24h';
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
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-500 border-t-transparent"></div>
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard de Energia</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Monitorização em tempo real - Solar + Rede</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {TIME_RANGES.map(range => (
            <button
              key={range.value}
              onClick={() => setTimeRange(range.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                timeRange === range.value
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
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

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <EnergyChart
          data={gridChartData}
          title={chartConfig.gridTitle}
          color="#3b82f6"
          unit="Wh"
          yAxisLabel="Energia (kWh)"
        />
        <EnergyChart
          data={solarChartData}
          title={chartConfig.solarTitle}
          color="#fbbf24"
          unit="Wh"
          yAxisLabel="Energia (kWh)"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <EnergyChart
          data={periodChartData}
          title={`Consumo Diário (${chartConfig.periodTitle})`}
          color="#ef4444"
          unit="Wh"
          yAxisLabel="Energia (kWh)"
        />
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Resumo do Período ({summaryTitle})
          </h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Total Consumo Casa</span>
              <span className="font-medium">{houseTotal.value.toFixed(2)} {houseTotal.unit}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Total Produção Solar</span>
              <span className="font-medium">{solarTotal.value.toFixed(2)} {solarTotal.unit}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Exportado para Rede</span>
              <span className="font-medium text-green-500">{exportTotal.value.toFixed(2)} {exportTotal.unit}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Importado da Rede</span>
              <span className="font-medium text-orange-500">{importTotal.value.toFixed(2)} {importTotal.unit}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Custo Estimado</span>
              <span className="font-medium">{formatCost(totals.cost_eur)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Autoconsumo</span>
              <span className="font-medium text-green-500">{formatPct(totals.autoconsumo_pct)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Autossuficiência</span>
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
      <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
        Atualizado: {new Date().toLocaleString('pt-PT')} | Próxima atualização automática em 60s
      </div>
    </div>
  );
}