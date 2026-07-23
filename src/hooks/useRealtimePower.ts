import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';

export interface DevicePower {
  device_id: string;
  device_type: string;
  power_w: number;
  total_wh: number;
  voltage_v: number;
  current_a: number;
  pf: number;
  read_at: string;
  updated_at: string;
}

export interface RealtimePowerData {
  solarPower: number;
  gridPower: number;
  housePower: number;
  connected: boolean;
  lastUpdate: Date | null;
}

const POLLING_INTERVAL_MS = 30000; // 30 seconds - matches energy-monitor-v2 sync interval

export function useRealtimePower(): RealtimePowerData {
  const [devices, setDevices] = useState<Record<string, DevicePower>>({});
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchLatestReadings() {
      try {
        const { data, error } = await supabase
          .from('latest_readings')
          .select('*');

        if (!cancelled && !error && data) {
          const map: Record<string, DevicePower> = {};
          data.forEach(d => { map[d.device_id] = d as DevicePower; });
          setDevices(map);
          setConnected(true);
        } else if (error) {
          console.warn('Failed to fetch latest_readings:', error.message);
          setConnected(false);
        }
      } catch (err) {
        console.error('Error fetching latest_readings:', err);
        setConnected(false);
      }
    }

    // Initial load
    fetchLatestReadings();

    // Polling interval
    const interval = setInterval(fetchLatestReadings, POLLING_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Computar valores derivados
  const realtimeData = useMemo((): RealtimePowerData => {
    const solar = devices['inversor'];
    const grid = devices['quadro_principal'];

    const solarPower = solar?.power_w ?? 0;
    const gridPower = grid?.power_w ?? 0;
    const housePower = solarPower + gridPower;

    // Última atualização (a mais recente entre os dois dispositivos)
    const updates = [solar?.updated_at, grid?.updated_at].filter(Boolean);
    const lastUpdate = updates.length > 0 
      ? new Date(Math.max(...updates.map(u => new Date(u).getTime()))) 
      : null;

    return {
      solarPower,
      gridPower,
      housePower,
      connected,
      lastUpdate,
    };
  }, [devices, connected]);

  return realtimeData;
}