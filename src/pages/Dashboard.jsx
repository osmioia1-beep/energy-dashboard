import React, { useState, useEffect, useCallback } from 'react'
import { RefreshCw, Zap, Activity, TrendingUp } from 'lucide-react'
import DeviceCard from '../components/DeviceCard'
import { getDevices, getDeviceStats, getLatestEvents } from '../services/supabase'

export default function Dashboard() {
  const [devices, setDevices] = useState([])
  const [recentEvents, setRecentEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [lastUpdate, setLastUpdate] = useState(null)

  const loadData = useCallback(async () => {
    try {
      setError(null)
      const [devs, events] = await Promise.all([
        getDevices(),
        getLatestEvents(10),
      ])

      const devicesWithStats = await Promise.all(
        devs.map(async (d) => {
          const stats = await getDeviceStats(d.name)
          return { ...d, stats }
        })
      )

      setDevices(devicesWithStats)
      setRecentEvents(events)
      setLastUpdate(new Date())
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 30000)
    return () => clearInterval(interval)
  }, [loadData])

  const handleRefresh = () => {
    setRefreshing(true)
    loadData()
  }

  const totalPower = devices.reduce((s, d) => s + (d.stats?.lastPower || 0), 0)
  const activeDevices = devices.filter(d => d.stats?.isOn).length

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-brand-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Top Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white dark:bg-gray-900 rounded-xl p-3 text-center border border-gray-200 dark:border-gray-800">
          <Zap className="w-5 h-5 text-yellow-500 mx-auto mb-1" />
          <p className="text-lg font-bold text-gray-900 dark:text-white">{totalPower.toFixed(0)}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Watts</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl p-3 text-center border border-gray-200 dark:border-gray-800">
          <Activity className="w-5 h-5 text-green-500 mx-auto mb-1" />
          <p className="text-lg font-bold text-gray-900 dark:text-white">{activeDevices}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Ativos</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl p-3 text-center border border-gray-200 dark:border-gray-800">
          <TrendingUp className="w-5 h-5 text-blue-500 mx-auto mb-1" />
          <p className="text-lg font-bold text-gray-900 dark:text-white">{devices.length}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Dispositivos</p>
        </div>
      </div>

      {/* Refresh */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Dispositivos</h2>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500 hover:text-brand-600 dark:hover:text-brand-500 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          {lastUpdate && (
            <span>{lastUpdate.toLocaleTimeString('pt-PT')}</span>
          )}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl p-3 text-red-600 dark:text-red-400 text-sm">
          ⚠️ {error}
        </div>
      )}

      {/* Device Cards */}
      <div className="grid gap-4">
        {devices.map((device) => (
          <DeviceCard key={device.name} device={device} />
        ))}
        {devices.length === 0 && !error && (
          <div className="text-center text-gray-400 dark:text-gray-500 py-8">
            <p>Sem dispositivos encontrados</p>
            <p className="text-xs mt-1">Os dados aparecem quando os Shelly enviam eventos</p>
          </div>
        )}
      </div>

      {/* Recent Events */}
      {recentEvents.length > 0 && (
        <>
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mt-6">
            Eventos Recentes
          </h2>
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 divide-y divide-gray-200 dark:divide-gray-800">
            {recentEvents.slice(0, 8).map((event, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full ${
                    event.event_type === 'start' || event.event_type === 'on'
                      ? 'bg-green-500' : 'bg-red-500'
                  }`} />
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{event.shelly_name || '—'}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">{event.event_type}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-900 dark:text-white">{event.power_watts?.toFixed(0) || '—'} W</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {event.created_at ? new Date(event.created_at).toLocaleTimeString('pt-PT') : '—'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
