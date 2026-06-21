import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Zap, Clock, TrendingUp, Activity } from 'lucide-react'
import { getDeviceEvents } from '../services/supabase'

function formatDuration(seconds) {
  if (!seconds) return '—'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function formatEnergy(wh) {
  if (!wh) return '—'
  if (wh >= 1000) return `${(wh / 1000).toFixed(2)} kWh`
  return `${wh.toFixed(0)} Wh`
}

export default function DeviceDetail() {
  const { name } = useParams()
  const decodedName = decodeURIComponent(name)
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function load() {
      try {
        const data = await getDeviceEvents(decodedName, 100)
        setEvents(data)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    load()
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [decodedName])

  // Pair start/stop events into sessions
  const sessions = []
  let currentStart = null
  for (const event of [...events].reverse()) {
    if (event.event_type === 'start' || event.event_type === 'on') {
      currentStart = event
    } else if ((event.event_type === 'stop' || event.event_type === 'off') && currentStart) {
      const duration = (new Date(event.created_at) - new Date(currentStart.created_at)) / 1000
      const energyDiff = Math.abs((event.total_energy_wh || 0) - (currentStart.total_energy_wh || 0))
      sessions.push({
        start: currentStart,
        stop: event,
        duration,
        energy: energyDiff < 10000 ? energyDiff : 0,
        startTime: new Date(currentStart.created_at),
        stopTime: new Date(event.created_at),
      })
      currentStart = null
    }
  }
  sessions.reverse()

  // Compute stats for a date range
  const now = new Date()
  const oneHourAgo = new Date(now - 3600 * 1000)
  const twoHoursAgo = new Date(now - 2 * 3600 * 1000)
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  const statsForRange = (fromDate, toDate) => {
    const filtered = sessions.filter(s => s.startTime >= fromDate && s.startTime < toDate)
    const count = filtered.length
    const duration = filtered.reduce((s, sess) => s + sess.duration, 0)
    const energy = filtered.reduce((s, sess) => s + sess.energy, 0)
    const avgP = count > 0
      ? filtered.reduce((s, sess) => s + (sess.duration > 0 ? (sess.energy / sess.duration) * 3600 : 0), 0) / count
      : 0
    return { count, duration, energy, avgPower: avgP }
  }

  const stats1h = statsForRange(oneHourAgo, now)
  const stats2h = statsForRange(twoHoursAgo, now)
  const statsToday = statsForRange(todayStart, now)
  const statsTotal = statsForRange(new Date(0), now)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-brand-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Back */}
      <Link to="/" className="flex items-center gap-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors">
        <ArrowLeft className="w-5 h-5" />
        <span className="text-sm">Voltar</span>
      </Link>

      {/* Title */}
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{decodedName}</h1>

      {/* Stats Grid — 4 periods × 4 metrics */}
      <div className="space-y-3">
        {/* Header */}
        <div className="grid grid-cols-5 gap-2 text-xs text-gray-400 dark:text-gray-500 px-1">
          <div className="col-span-1" />
          <div className="text-center font-semibold">1h</div>
          <div className="text-center font-semibold">2h</div>
          <div className="text-center font-semibold">Hoje</div>
          <div className="text-center font-semibold">Total</div>
        </div>

        {/* Arranques */}
        <div className="grid grid-cols-5 gap-2 items-center bg-white dark:bg-gray-900 rounded-xl p-3 border border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-2 col-span-1">
            <Activity className="w-4 h-4 text-green-500 shrink-0" />
            <span className="text-xs font-medium text-gray-600 dark:text-gray-300">Arranques</span>
          </div>
          <div className="text-center text-sm font-bold text-gray-900 dark:text-white">{stats1h.count}</div>
          <div className="text-center text-sm font-bold text-gray-900 dark:text-white">{stats2h.count}</div>
          <div className="text-center text-sm font-bold text-gray-900 dark:text-white">{statsToday.count}</div>
          <div className="text-center text-sm font-bold text-gray-900 dark:text-white">{statsTotal.count}</div>
        </div>

        {/* Tempo Ligado */}
        <div className="grid grid-cols-5 gap-2 items-center bg-white dark:bg-gray-900 rounded-xl p-3 border border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-2 col-span-1">
            <Clock className="w-4 h-4 text-blue-500 shrink-0" />
            <span className="text-xs font-medium text-gray-600 dark:text-gray-300">Tempo</span>
          </div>
          <div className="text-center text-sm font-bold text-gray-900 dark:text-white">{formatDuration(stats1h.duration)}</div>
          <div className="text-center text-sm font-bold text-gray-900 dark:text-white">{formatDuration(stats2h.duration)}</div>
          <div className="text-center text-sm font-bold text-gray-900 dark:text-white">{formatDuration(statsToday.duration)}</div>
          <div className="text-center text-sm font-bold text-gray-900 dark:text-white">{formatDuration(statsTotal.duration)}</div>
        </div>

        {/* Energia */}
        <div className="grid grid-cols-5 gap-2 items-center bg-white dark:bg-gray-900 rounded-xl p-3 border border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-2 col-span-1">
            <TrendingUp className="w-4 h-4 text-purple-500 shrink-0" />
            <span className="text-xs font-medium text-gray-600 dark:text-gray-300">Energia</span>
          </div>
          <div className="text-center text-sm font-bold text-gray-900 dark:text-white">{formatEnergy(stats1h.energy)}</div>
          <div className="text-center text-sm font-bold text-gray-900 dark:text-white">{formatEnergy(stats2h.energy)}</div>
          <div className="text-center text-sm font-bold text-gray-900 dark:text-white">{formatEnergy(statsToday.energy)}</div>
          <div className="text-center text-sm font-bold text-gray-900 dark:text-white">{formatEnergy(statsTotal.energy)}</div>
        </div>

        {/* Potência Média */}
        <div className="grid grid-cols-5 gap-2 items-center bg-white dark:bg-gray-900 rounded-xl p-3 border border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-2 col-span-1">
            <Zap className="w-4 h-4 text-yellow-500 shrink-0" />
            <span className="text-xs font-medium text-gray-600 dark:text-gray-300">Pot. Média</span>
          </div>
          <div className="text-center text-sm font-bold text-gray-900 dark:text-white">{stats1h.avgPower.toFixed(0)} W</div>
          <div className="text-center text-sm font-bold text-gray-900 dark:text-white">{stats2h.avgPower.toFixed(0)} W</div>
          <div className="text-center text-sm font-bold text-gray-900 dark:text-white">{statsToday.avgPower.toFixed(0)} W</div>
          <div className="text-center text-sm font-bold text-gray-900 dark:text-white">{statsTotal.avgPower.toFixed(0)} W</div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl p-3 text-red-600 dark:text-red-400 text-sm">
          ⚠️ {error}
        </div>
      )}

      {/* Sessions */}
      <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
        Sessões ({sessions.length})
      </h2>

      <div className="space-y-2">
        {sessions.slice(0, 20).map((session, i) => (
          <div key={i} className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {new Date(session.start.created_at).toLocaleDateString('pt-PT', {
                  day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                })}
              </span>
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {new Date(session.stop.created_at).toLocaleTimeString('pt-PT')}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-xs text-gray-400 dark:text-gray-500">Duração</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{formatDuration(session.duration)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 dark:text-gray-500">Energia</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{formatEnergy(session.energy)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 dark:text-gray-500">Potência</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {session.duration > 0
                    ? `${((session.energy / session.duration) * 3600).toFixed(0)} W`
                    : '—'}
                </p>
              </div>
            </div>
          </div>
        ))}
        {sessions.length === 0 && (
          <p className="text-center text-gray-400 dark:text-gray-500 py-8 text-sm">Sem sessões registadas</p>
        )}
      </div>
    </div>
  )
}
