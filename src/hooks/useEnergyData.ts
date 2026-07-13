import { useState, useEffect, useMemo } from 'react';
import { 
  fetchHourlyAggregates, 
  fetchDailyAggregates, 
  type HourlyAggregate, 
  type DailyAggregate 
} from '../lib/supabase';

export type TimeRange = 'today' | 'yesterday' | '24h' | '7d' | '30d' | 'total';

export interface UnifiedDataPoint {
  bucket: string;
  device_id: string;
  energy_wh: number;
  avg_power_w: number;
  max_power_w: number;
  cost_eur?: number;
  exported_wh?: number;
  granularity: 'hour' | 'day' | 'month';
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

interface UseEnergyDataResult {
  hourlyData: HourlyAggregate[];
  dailyData: DailyAggregate[];
  unifiedData: UnifiedDataPoint[];
  totals: AggregatedTotals;
  loading: boolean;
  error: string | null;
  timeRange: TimeRange;
  setTimeRange: (range: TimeRange) => void;
  refetch: () => Promise<void>;
}

function getTimeRangeParams(range: TimeRange): { hours: number; days: number } {
  switch (range) {
    case 'today': return { hours: 24, days: 1 };
    case 'yesterday': return { hours: 48, days: 2 };
    case '24h': return { hours: 24, days: 1 };
    case '7d': return { hours: 168, days: 7 };
    case '30d': return { hours: 720, days: 30 };
    case 'total': return { hours: 8760, days: 365 };
  }
}

function getDateRange(range: TimeRange): { start: Date; end: Date } {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  
  switch (range) {
    case 'today': {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return { start, end };
    }
    case 'yesterday': {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      const endYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59);
      return { start, end: endYesterday };
    }
    case '24h': {
      const start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      return { start, end: now };
    }
    case '7d': {
      const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return { start, end: now };
    }
    case '30d': {
      const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return { start, end: now };
    }
    case 'total': {
      const start = new Date(now.getFullYear(), 0, 1);
      return { start, end: now };
    }
  }
}

function filterByRange<T extends { bucket: string }>(
  data: T[], 
  range: TimeRange
): T[] {
  const { start, end } = getDateRange(range);
  return data.filter(d => {
    const bucketDate = new Date(d.bucket);
    return bucketDate >= start && bucketDate <= end;
  });
}

function unifyData(
  hourly: HourlyAggregate[], 
  daily: DailyAggregate[], 
  range: TimeRange
): UnifiedDataPoint[] {
  const isHourly = range === 'today' || range === 'yesterday' || range === '24h';
  const source = isHourly ? hourly : daily;
  const granularity = isHourly ? 'hour' : range === 'total' ? 'month' : 'day';

  return source.map(d => ({
    bucket: d.bucket,
    device_id: d.device_id,
    energy_wh: d.energy_wh || 0,
    avg_power_w: d.avg_power_w || 0,
    max_power_w: d.max_power_w || 0,
    cost_eur: 'cost_eur' in d ? (d as DailyAggregate).cost_eur || 0 : undefined,
    exported_wh: 'exported_wh' in d ? (d as DailyAggregate).exported_wh || 0 : undefined,
    granularity,
  }));
}

function calculateTotals(unified: UnifiedDataPoint[]): AggregatedTotals {
  const solar = unified.filter(d => d.device_id === 'inversor');
  const grid = unified.filter(d => d.device_id === 'quadro_principal');

  const solar_wh = solar.reduce((sum, d) => sum + d.energy_wh, 0);
  const grid_wh = grid.reduce((sum, d) => sum + d.energy_wh, 0);

  // Export/Import do grid (quadro_principal)
  const export_wh = grid
    .filter(d => d.energy_wh < 0)
    .reduce((sum, d) => sum + Math.abs(d.energy_wh), 0);
  const import_wh = grid
    .filter(d => d.energy_wh > 0)
    .reduce((sum, d) => sum + d.energy_wh, 0);

  // House consumption = solar + grid (grid já tem sinal)
  const house_wh = solar_wh + grid_wh;

  // Custo apenas de daily aggregates
  const cost_eur = unified
    .filter(d => d.cost_eur !== undefined)
    .reduce((sum, d) => sum + (d.cost_eur || 0), 0);

  // Autoconsumo = (solar - exportado) / solar
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

export function useEnergyData(initialRange: TimeRange = '24h'): UseEnergyDataResult {
  const [hourlyData, setHourlyData] = useState<HourlyAggregate[]>([]);
  const [dailyData, setDailyData] = useState<DailyAggregate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>(initialRange);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { hours, days } = getTimeRangeParams(timeRange);
      
      const fetchHours = timeRange === 'total' ? 8760 : hours;
      const fetchDays = timeRange === 'total' ? 365 : days;

      const [hourly, daily] = await Promise.all([
        fetchHourlyAggregates(fetchHours),
        fetchDailyAggregates(fetchDays),
      ]);

      setHourlyData(hourly);
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

  // Filtrar dados conforme range selecionado
  const filteredHourly = useMemo(
    () => filterByRange(hourlyData, timeRange),
    [hourlyData, timeRange]
  );
  const filteredDaily = useMemo(
    () => filterByRange(dailyData, timeRange),
    [dailyData, timeRange]
  );

  const unifiedData = useMemo(
    () => unifyData(filteredHourly, filteredDaily, timeRange),
    [filteredHourly, filteredDaily, timeRange]
  );

  const totals = useMemo(
    () => calculateTotals(unifiedData),
    [unifiedData]
  );

  return {
    hourlyData: filteredHourly,
    dailyData: filteredDaily,
    unifiedData,
    totals,
    loading,
    error,
    timeRange,
    setTimeRange,
    refetch: fetchData,
  };
}

// Helpers para formatação
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