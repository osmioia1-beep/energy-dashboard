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

  // Filter out false positive events (start events with negligible power)
  const filteredEvents = events.filter(e => {
    if ((e.event_type === 'start' || e.event_type === 'on') && (e.power_watts || 0) < 10) return false;
    return true;
  });

  // Pair start/stop events into sessions
  const sessions = []
  let currentStart = null
  for (const event of [...filteredEvents].reverse()) {
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
        active: false,
      })
      currentStart = null
    }
  }
  // If there's an unpaired start, the device is currently running
  if (currentStart) {
    const now = new Date()
    const duration = (now - new Date(currentStart.created_at)) / 1000
    sessions.push({
      start: currentStart,
      stop: null,
      duration,
      energy: 0,
      startTime: new Date(currentStart.created_at),
      stopTime: now,
      active: true,
    })
  }
  sessions.reverse()

  // Compute stats for a date range
  const now = new Date()
  const oneHourAgo = new Date(now - 3600 * 1000)
  const twentyFourHoursAgo = new Date(now - 24 * 3600 * 1000)
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
  const stats24h = statsForRange(twentyFourHoursAgo, now)
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

      {/* Stats Grid — periods as rows, metrics as columns */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-5 gap-2 p-3 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
          <div className="text-xs font-semibold text-gray-400 dark:text-gray-500" />
          <div className="text-center text-xs font-semibold text-gray-500 dark:text-gray-400">Arranques</div>
          <div className="text-center text-xs font-semibold text-gray-500 dark:text-gray-400">Tempo</div>
          <div className="text-center text-xs font-semibold text-gray-500 dark:text-gray-400">Energia</div>
          <div className="text-center text-xs font-semibold text-gray-500 dark:text-gray-400">Pot. Média</div>
        </div>

        {/* 1h */}
        <div className="grid grid-cols-5 gap-2 p-3 border-b border-gray-100 dark:border-gray-800 items-center">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-green-500 shrink-0" />
            <span className="text-xs font-medium text-gray-600 dark:text-gray-300">1h</span>
          </div>
          <div className="text-center text-sm font-bold text-gray-900 dark:text-white">{stats1h.count}</div>
          <div className="text-center text-sm font-bold text-gray-900 dark:text-white">{formatDuration(stats1h.duration)}</div>
          <div className="text-center text-sm font-bold text-gray-900 dark:text-white">{formatEnergy(stats1h.energy)}</div>
          <div className="text-center text-sm font-bold text-gray-900 dark:text-white">{stats1h.avgPower.toFixed(0)} W</div>
        </div>

        {/* 24h */}
        <div className="grid grid-cols-5 gap-2 p-3 border-b border-gray-100 dark:border-gray-800 items-center">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-500 shrink-0" />
            <span className="text-xs font-medium text-gray-600 dark:text-gray-300">24h</span>
          </div>
          <div className="text-center text-sm font-bold text-gray-900 dark:text-white">{stats24h.count}</div>
          <div className="text-center text-sm font-bold text-gray-900 dark:text-white">{formatDuration(stats24h.duration)}</div>
          <div className="text-center text-sm font-bold text-gray-900 dark:text-white">{formatEnergy(stats24h.energy)}</div>
          <div className="text-center text-sm font-bold text-gray-900 dark:text-white">{stats24h.avgPower.toFixed(0)} W</div>
        </div>

        {/* Hoje */}
        <div className="grid grid-cols-5 gap-2 p-3 border-b border-gray-100 dark:border-gray-800 items-center">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-purple-500 shrink-0" />
            <span className="text-xs font-medium text-gray-600 dark:text-gray-300">Hoje</span>
          </div>
          <div className="text-center text-sm font-bold text-gray-900 dark:text-white">{statsToday.count}</div>
          <div className="text-center text-sm font-bold text-gray-900 dark:text-white">{formatDuration(statsToday.duration)}</div>
          <div className="text-center text-sm font-bold text-gray-900 dark:text-white">{formatEnergy(statsToday.energy)}</div>
          <div className="text-center text-sm font-bold text-gray-900 dark:text-white">{statsToday.avgPower.toFixed(0)} W</div>
        </div>

        {/* Total */}
        <div className="grid grid-cols-5 gap-2 p-3 items-center">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-yellow-500 shrink-0" />
            <span className="text-xs font-medium text-gray-600 dark:text-gray-300">Total</span>
          </div>
          <div className="text-center text-sm font-bold text-gray-900 dark:text-white">{statsTotal.count}</div>
          <div className="text-center text-sm font-bold text-gray-900 dark:text-white">{formatDuration(statsTotal.duration)}</div>
          <div className="text-center text-sm font-bold text-gray-900 dark:text-white">{formatEnergy(statsTotal.energy)}</div>
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
          <div key={i} className={`rounded-xl p-4 border ${session.active ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700' : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800'}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {new Date(session.start.created_at).toLocaleDateString('pt-PT', {
                    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                  })}
                </span>
                {session.active && (
                  <span className="text-xs bg-green-500 text-white px-2 py-0.5 rounded-full font-semibold animate-pulse">
                    EM CURSO
                  </span>
                )}
              </div>
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {session.stop ? new Date(session.stop.created_at).toLocaleTimeString('pt-PT') : 'agora'}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-xs text-gray-400 dark:text-gray-500">Duração</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{formatDuration(session.duration)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 dark:text-gray-500">Energia</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {session.active ? '—' : formatEnergy(session.energy)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400 dark:text-gray-500">Potência</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {session.active
                    ? `${session.start.power_watts?.toFixed(0) || '—'} W`
                    : session.duration > 0
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
