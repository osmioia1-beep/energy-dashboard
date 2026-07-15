import { useState, useEffect, useMemo } from 'react';
import { 
  fetchDailyAggregates, 
  type DailyAggregate 
} from '../lib/supabase';

export type TimeRange = 'today' | 'yesterday' | '7d' | '30d' | 'total';

export interface UnifiedDataPoint {
  bucket: string;
  device_id: string;
  energy_wh: number;
  avg_power_w: number;
  max_power_w: number;
  cost_eur?: number;
  exported_wh?: number;
  granularity: 'day' | 'month';
}

export interface AggregatedTotals {
  solar_wh: number;
  grid_wh: number;
  house_wh: number;
  export_wh: number;
  import_wh: number;
  cost_eur: number;
  autoconsumo_pct: number;
}

export interface RealTimeData {
  solarPower: number;
  gridPower: number;
  housePower: number;
  exportPower: number;
  importPower: number;
}

interface UseEnergyDataResult {
  dailyData: DailyAggregate[];
  unifiedData: UnifiedDataPoint[];
  totals: AggregatedTotals;
  realTime: RealTimeData;
  loading: boolean;
  error: string | null;
  timeRange: TimeRange;
  setTimeRange: (range: TimeRange) => void;
  refetch: () => Promise<void>;
}

function getTimeRangeParams(range: TimeRange): { days: number } {
  switch (range) {
    case 'today': return { days: 1 };
    case 'yesterday': return { days: 2 };
    case '7d': return { days: 7 };
    case '30d': return { days: 30 };
    case 'total': return { days: 365 };
  }
}

function getDateRange(range: TimeRange): { start: Date; end: Date } {
  const now = new Date();
  
  switch (range) {
    case 'today': {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      return { start, end };
    }
    case 'yesterday': {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59);
      return { start, end };
    }
    case '7d': {
      const end = new Date(now);
      const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return { start, end };
    }
    case '30d': {
      const end = new Date(now);
      const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return { start, end };
    }
    case 'total': {
      const start = new Date(now.getFullYear(), 0, 1);
      const end = new Date(now);
      return { start, end };
    }
  }
}

function filterByRange<T extends { bucket: string }>(data: T[], range: TimeRange): T[] {
  const { start, end } = getDateRange(range);
  return data.filter(d => {
    const bucketDate = new Date(d.bucket);
    return bucketDate >= start && bucketDate <= end;
  });
}

function unifyData(
  daily: DailyAggregate[],
  range: TimeRange
): UnifiedDataPoint[] {
  const granularity = range === 'total' ? 'month' : 'day';

  return daily.map(d => ({
    bucket: d.bucket,
    device_id: d.device_id,
    energy_wh: d.energy_wh || 0,
    avg_power_w: d.avg_power_w || 0,
    max_power_w: d.max_power_w || 0,
    cost_eur: d.cost_eur ?? undefined,
    exported_wh: d.exported_wh ?? undefined,
    granularity,
  }));
}

function calculateTotals(unified: UnifiedDataPoint[]): AggregatedTotals {
  const solar = unified.filter(d => d.device_id === 'inversor');
  const grid = unified.filter(d => d.device_id === 'quadro_principal');

  const solar_wh = solar.reduce((sum, d) => sum + d.energy_wh, 0);
  const grid_wh = grid.reduce((sum, d) => sum + d.energy_wh, 0);

  // Export/Import from grid (quadro_principal)
  const export_wh = grid
    .filter(d => d.energy_wh < 0)
    .reduce((sum, d) => sum + Math.abs(d.energy_wh), 0);
  const import_wh = grid
    .filter(d => d.energy_wh > 0)
    .reduce((sum, d) => sum + d.energy_wh, 0);

  // House consumption = solar + grid (grid already has sign)
  const house_wh = solar_wh + grid_wh;

  // Cost: sum from ALL unified points that have cost_eur (daily data merged in)
  // Only quadro_principal has cost data
  const cost_eur = unified
    .filter(d => d.cost_eur !== undefined)
    .reduce((sum, d) => sum + (d.cost_eur || 0), 0);

  // Autoconsumo = (solar - exported) / solar * 100
  // exported_wh comes from daily aggregate (energia exportada para a rede)
  const exported_wh = unified
    .filter(d => d.exported_wh !== undefined)
    .reduce((sum, d) => sum + (d.exported_wh || 0), 0);

  const autoconsumo_pct = solar_wh > 0
    ? Math.min(100, ((solar_wh - exported_wh) / solar_wh) * 100)
    : 0;

  return {
    solar_wh,
    grid_wh,
    house_wh,
    export_wh,
    import_wh,
    cost_eur,
    autoconsumo_pct,
  };
}

function getLatestRealTime(daily: DailyAggregate[]): RealTimeData {
  // Para tempo real, usamos os dados mais recentes disponíveis do daily_aggregates
  // Pegamos o último registro de cada dispositivo
  const latestGrid = daily
    .filter(d => d.device_id === 'quadro_principal')
    .sort((a, b) => new Date(b.bucket).getTime() - new Date(a.bucket).getTime())[0];
  const latestSolar = daily
    .filter(d => d.device_id === 'inversor')
    .sort((a, b) => new Date(b.bucket).getTime() - new Date(a.bucket).getTime())[0];

  const gridPower = latestGrid?.avg_power_w || 0;
  const solarPower = latestSolar?.avg_power_w || 0;
  const housePower = gridPower + solarPower;
  const exportPower = gridPower < 0 ? Math.abs(gridPower) : 0;
  const importPower = gridPower > 0 ? gridPower : 0;

  return {
    solarPower,
    gridPower,
    housePower,
    exportPower,
    importPower,
  };
}

export function useEnergyData(initialRange: TimeRange = '7d'): UseEnergyDataResult {
  const [dailyData, setDailyData] = useState<DailyAggregate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>(initialRange);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { days } = getTimeRangeParams(timeRange);
      
      // Fetch enough daily data to cover the range + buffer
      const fetchDays = timeRange === 'total' ? 365 : Math.min(days + 7, 365);

      const daily = await fetchDailyAggregates(fetchDays);

      setDailyData(daily);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [timeRange]);

  // Filter data by selected range (for charts and totals)
  const filteredDaily = useMemo(
    () => filterByRange(dailyData, timeRange),
    [dailyData, timeRange]
  );

  // Unify: merge daily source with daily cost/export data
  const unifiedData = useMemo(
    () => unifyData(filteredDaily, timeRange),
    [filteredDaily, timeRange]
  );

  const totals = useMemo(
    () => calculateTotals(unifiedData),
    [unifiedData]
  );

  // Real-time: uses LATEST unfiltered daily reading
  const realTime = useMemo(
    () => getLatestRealTime(dailyData),
    [dailyData]
  );

  return {
    dailyData: filteredDaily,
    unifiedData,
    totals,
    realTime,
    loading,
    error,
    timeRange,
    setTimeRange,
    refetch: fetchData,
  };
}

// Formatting helpers
export function formatEnergy(wh: number): { value: number; unit: string } {
  if (wh >= 1_000_000) return { value: wh / 1_000_000, unit: 'MWh' };
  if (wh >= 1_000) return { value: wh / 1_000, unit: 'kWh' };
  return { value: wh, unit: 'Wh' };
}

export function formatPower(w: number): { value: number; unit: string } {
  if (w >= 1_000_000) return { value: w / 1_000_000, unit: 'MW' };
  if (w >= 1_000) return { value: w / 1_000, unit: 'kW' };
  return { value: w, unit: 'W' };
}

export function formatCost(eur: number): string {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(eur);
}

export function formatPct(pct: number): string {
  return `${pct.toFixed(1)}%`;
}