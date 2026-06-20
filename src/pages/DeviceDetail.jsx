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

  // Pair start/stop events
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
      })
      currentStart = null
    }
  }

  const totalEnergy = sessions.reduce((s, sess) => s + sess.energy, 0)
  const totalDuration = sessions.reduce((s, sess) => s + sess.duration, 0)
  const avgPower = events.length > 0
    ? events.reduce((s, e) => s + (e.power_watts || 0), 0) / events.length
    : 0

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
      <Link to="/" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
        <ArrowLeft className="w-5 h-5" />
        <span className="text-sm">Voltar</span>
      </Link>

      {/* Title */}
      <h1 className="text-2xl font-bold text-white">{decodedName}</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4 text-yellow-500" />
            <span className="text-xs text-gray-500">Potência Média</span>
          </div>
          <p className="text-xl font-bold text-white">{avgPower.toFixed(0)} W</p>
        </div>
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-4 h-4 text-green-500" />
            <span className="text-xs text-gray-500">Sessões</span>
          </div>
          <p className="text-xl font-bold text-white">{sessions.length}</p>
        </div>
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-blue-500" />
            <span className="text-xs text-gray-500">Tempo Total</span>
          </div>
          <p className="text-xl font-bold text-white">{formatDuration(totalDuration)}</p>
        </div>
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-purple-500" />
            <span className="text-xs text-gray-500">Energia Total</span>
          </div>
          <p className="text-xl font-bold text-white">{formatEnergy(totalEnergy)}</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-800 rounded-xl p-3 text-red-400 text-sm">
          ⚠️ {error}
        </div>
      )}

      {/* Sessions */}
      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
        Sessões ({sessions.length})
      </h2>

      <div className="space-y-2">
        {sessions.slice(0, 20).map((session, i) => (
          <div key={i} className="bg-gray-900 rounded-xl p-4 border border-gray-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-white">
                {new Date(session.start.created_at).toLocaleDateString('pt-PT', {
                  day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                })}
              </span>
              <span className="text-xs text-gray-500">
                {new Date(session.stop.created_at).toLocaleTimeString('pt-PT')}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-xs text-gray-500">Duração</p>
                <p className="text-sm font-semibold text-white">{formatDuration(session.duration)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Energia</p>
                <p className="text-sm font-semibold text-white">{formatEnergy(session.energy)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Potência</p>
                <p className="text-sm font-semibold text-white">
                  {session.duration > 0
                    ? `${((session.energy / session.duration) * 3600).toFixed(0)} W`
                    : '—'}
                </p>
              </div>
            </div>
          </div>
        ))}
        {sessions.length === 0 && (
          <p className="text-center text-gray-500 py-8 text-sm">Sem sessões registadas</p>
        )}
      </div>
    </div>
  )
}
