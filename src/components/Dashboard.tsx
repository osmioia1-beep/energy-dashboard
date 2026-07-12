import { useState, useEffect } from 'react';
import { fetchHourlyAggregates, fetchDailyAggregates, type HourlyAggregate, type DailyAggregate } from '../lib/supabase';
import { PowerCard } from './PowerCard';
import { EnergyChart } from './EnergyChart';

export function Dashboard() {
  const [hourlyData, setHourlyData] = useState<HourlyAggregate[]>([]);
  const [dailyData, setDailyData] = useState<DailyAggregate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('24h');

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const hours = timeRange === '24h' ? 24 : timeRange === '7d' ? 168 : 720;
      const days = timeRange === '24h' ? 1 : timeRange === '7d' ? 7 : 30;
      
      const [hourly, daily] = await Promise.all([
        fetchHourlyAggregates(hours),
        fetchDailyAggregates(days),
      ]);
      
      setHourlyData(hourly);
      setDailyData(daily);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [timeRange]);

  // Filter data
  const quadroHourly = hourlyData.filter(d => d.device_id === 'quadro_principal');
  const inversorHourly = hourlyData.filter(d => d.device_id === 'inversor');

  const quadroDaily = dailyData.filter(d => d.device_id === 'quadro_principal');
  const inversorDaily = dailyData.filter(d => d.device_id === 'inversor');

  // Latest values
  const latestGrid = quadroHourly[0];
  const latestSolar = inversorHourly[0];
  const latestGridDaily = quadroDaily[0];
  const latestSolarDaily = inversorDaily[0];

  // Calculate house consumption
  const currentHousePower = (latestGrid?.avg_power_w || 0) + (latestSolar?.avg_power_w || 0);
  const currentExport = latestGrid?.avg_power_w && latestGrid.avg_power_w < 0 
    ? Math.abs(latestGrid.avg_power_w) 
    : 0;
  const currentImport = latestGrid?.avg_power_w && latestGrid.avg_power_w > 0 
    ? latestGrid.avg_power_w 
    : 0;

  // Chart data - last 24h
  const gridChartData = quadroHourly
    .slice(0, 24)
    .reverse()
    .map(d => ({
      time: new Date(d.bucket).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }),
      value: d.energy_wh || 0,
      label: new Date(d.bucket).toLocaleTimeString('pt-PT', { hour: '2-digit' }),
    }));

  const solarChartData = inversorHourly
    .slice(0, 24)
    .reverse()
    .map(d => ({
      time: new Date(d.bucket).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }),
      value: d.energy_wh || 0,
      label: new Date(d.bucket).toLocaleTimeString('pt-PT', { hour: '2-digit' }),
    }));

  const dailyChartData = quadroDaily
    .slice(0, 7)
    .reverse()
    .map(d => ({
      time: new Date(d.bucket).toLocaleDateString('pt-PT', { weekday: 'short', day: '2-digit', month: '2-digit' }),
      value: d.energy_wh || 0,
      label: new Date(d.bucket).toLocaleDateString('pt-PT', { weekday: 'short' }),
    }));

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
        <button 
          onClick={fetchData}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with time range selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard de Energia</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Monitorização em tempo real - Solar + Rede</p>
        </div>
        <div className="flex gap-2">
          {['24h', '7d', '30d'].map(range => (
            <button
              key={range}
              onClick={() => setTimeRange(range as '24h' | '7d' | '30d')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                timeRange === range
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* Power Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <PowerCard
          label="Produção Solar"
          value={latestSolar?.avg_power_w || 0}
          unit="W"
          color="text-amber-500"
          icon="☀️"
          trend={latestSolar?.avg_power_w && inversorHourly[1]?.avg_power_w 
            ? ((latestSolar.avg_power_w - inversorHourly[1].avg_power_w) / Math.abs(inversorHourly[1].avg_power_w || 1)) * 100
            : undefined}
        />
        <PowerCard
          label="Rede Elétrica"
          value={latestGrid?.avg_power_w || 0}
          unit="W"
          color={latestGrid?.avg_power_w && latestGrid.avg_power_w < 0 ? 'text-green-500' : 'text-orange-500'}
          icon="⚡"
          trend={latestGrid?.avg_power_w && quadroHourly[1]?.avg_power_w
            ? ((latestGrid.avg_power_w - quadroHourly[1].avg_power_w) / Math.abs(quadroHourly[1].avg_power_w || 1)) * 100
            : undefined}
        />
        <PowerCard
          label="Consumo Casa"
          value={currentHousePower}
          unit="W"
          color="text-red-500"
          icon="🏠"
        />
        <PowerCard
          label={currentExport > 0 ? 'Exportando' : 'Importando'}
          value={currentExport > 0 ? currentExport : currentImport}
          unit="W"
          color={currentExport > 0 ? 'text-green-500' : 'text-orange-500'}
          icon={currentExport > 0 ? '📤' : '📥'}
        />
      </div>

      {/* Daily Energy Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <PowerCard
          label="Solar Hoje"
          value={latestSolarDaily?.energy_wh || 0}
          unit="Wh"
          color="text-amber-500"
          icon="☀️"
          trend={latestSolarDaily?.energy_wh && inversorDaily[1]?.energy_wh
            ? ((latestSolarDaily.energy_wh - inversorDaily[1].energy_wh) / Math.abs(inversorDaily[1].energy_wh || 1)) * 100
            : undefined}
        />
        <PowerCard
          label="Rede Hoje"
          value={latestGridDaily?.energy_wh || 0}
          unit="Wh"
          color="text-blue-500"
          icon="⚡"
          trend={latestGridDaily?.energy_wh && quadroDaily[1]?.energy_wh
            ? ((latestGridDaily.energy_wh - quadroDaily[1].energy_wh) / Math.abs(quadroDaily[1].energy_wh || 1)) * 100
            : undefined}
        />
        <PowerCard
          label="Custo Hoje"
          value={(latestGridDaily?.cost_eur || 0)}
          unit="€"
          color="text-orange-500"
          icon="💰"
        />
        <PowerCard
          label="Autoconsumo"
          value={latestSolarDaily?.energy_wh && latestGridDaily?.energy_wh 
            ? ((latestSolarDaily.energy_wh - Math.abs(latestGridDaily.energy_wh || 0)) / latestSolarDaily.energy_wh) * 100
            : 0}
          unit="%"
          color="text-green-500"
          icon="♻️"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <EnergyChart
          data={gridChartData}
          title="Consumo/Rede (últimas 24h)"
          color="#3b82f6"
          unit="Wh"
        />
        <EnergyChart
          data={solarChartData}
          title="Produção Solar (últimas 24h)"
          color="#fbbf24"
          unit="Wh"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <EnergyChart
          data={dailyChartData}
          title="Consumo Diário (últimos 7 dias)"
          color="#ef4444"
          unit="Wh"
        />
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Resumo do Período</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Total Consumo Casa</span>
              <span className="font-medium">{(dailyChartData.reduce((a, b) => a + b.value, 0) / 1000).toFixed(2)} kWh</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Total Produção Solar</span>
              <span className="font-medium">{((inversorDaily.slice(0,7).reduce((a, b) => a + (b.energy_wh || 0), 0)) / 1000).toFixed(2)} kWh</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Custo Estimado</span>
              <span className="font-medium">{quadroDaily.slice(0,7).reduce((a, b) => a + (b.cost_eur || 0), 0).toFixed(2)} €</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Autossuficiência</span>
              <span className="font-medium text-green-500">
                {(() => {
                  const solar = inversorDaily.slice(0,7).reduce((a, b) => a + (b.energy_wh || 0), 0);
                  const grid = Math.abs(quadroDaily.slice(0,7).reduce((a, b) => a + (b.energy_wh || 0), 0));
                  return solar > 0 ? ((solar - grid) / solar * 100).toFixed(1) : '0';
                })()}%
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