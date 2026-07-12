import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://lfatskduuzwdqoomtphh.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmYXRza2R1dXp3ZHFvb210cGhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYyNDI4NjUsImV4cCI6MjA2MTgxODg2NX0.JzaQ';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export interface HourlyAggregate {
  device_id: string;
  bucket: string;
  avg_power_w: number | null;
  min_power_w: number | null;
  max_power_w: number | null;
  energy_wh: number | null;
  min_voltage_v: number | null;
  max_voltage_v: number | null;
  readings_count: number;
}

export interface DailyAggregate {
  device_id: string;
  bucket: string;
  energy_wh: number | null;
  exported_wh: number | null;
  cost_eur: number | null;
  max_power_w: number | null;
  avg_power_w: number | null;
  min_voltage_v: number | null;
  max_voltage_v: number | null;
  uptime_pct: number | null;
}

export async function fetchHourlyAggregates(hours: number = 24): Promise<HourlyAggregate[]> {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  
  const { data, error } = await supabase
    .from('hourly_aggregates')
    .select('*')
    .gte('bucket', since)
    .order('bucket', { ascending: false });
  
  if (error) throw error;
  return data || [];
}

export async function fetchDailyAggregates(days: number = 30): Promise<DailyAggregate[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  const { data, error } = await supabase
    .from('daily_aggregates')
    .select('*')
    .gte('bucket', since)
    .order('bucket', { ascending: false });
  
  if (error) throw error;
  return data || [];
}