import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Car, Zap, Clock, TrendingUp, Battery } from 'lucide-react'
import { getV2CSessions, getV2CStats } from '../services/supabase'

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

export default function V2CPage() {
  const [sessions, setSessions] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function load() {
      try {
        const [sessData, statsData] = await Promise.all([
          getV2CSessions(20),
          getV2CStats(),
        ])
        setSessions(sessData); console.log("[V2C] Sessions loaded:", sessData.length, sessData)
        setStats(statsData); console.log("[V2C] Stats loaded:", statsData)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    load()
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [])

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
      <div className="flex items-center gap-3">
        <Car className="w-7 h-7 text-brand-500" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">V2C Trydan</h1>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-yellow-500" />
              <span className="text-xs text-gray-400 dark:text-gray-500">Sessões</span>
            </div>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{stats.totalSessions}</p>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800">
            <div className="flex items-center gap-2 mb-2">
              <Battery className="w-4 h-4 text-green-500" />
              <span className="text-xs text-gray-400 dark:text-gray-500">Energia Total</span>
            </div>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{formatEnergy(stats.totalEnergyWh)}</p>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-blue-500" />
              <span className="text-xs text-gray-400 dark:text-gray-500">Tempo Total</span>
            </div>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{formatDuration(stats.totalDurationS)}</p>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-purple-500" />
              <span className="text-xs text-gray-400 dark:text-gray-500">Potência Média</span>
            </div>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{(stats.avgPower || 0).toFixed(0)} W</p>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl p-3 text-red-600 dark:text-red-400 text-sm">
          ⚠️ {error}
        </div>
      )}

      {/* Sessions */}
      <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
        Sessões de Carregamento ({sessions.length})
      </h2>

      <div className="space-y-2">
        {sessions.map((session) => (
          <div key={session.id} className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Car className="w-4 h-4 text-brand-500" />
                <span className="text-sm font-medium text-gray-900 dark:text-white">{session.carro || 'Carro'}</span>
              </div>
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {session.start_time
                  ? new Date(session.start_time).toLocaleDateString('pt-PT', {
                      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                    })
                  : '—'}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-xs text-gray-400 dark:text-gray-500">Energia</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{formatEnergy(session.total_energy_wh)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 dark:text-gray-500">Duração</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{formatDuration(session.duration_seconds)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 dark:text-gray-500">Potência</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {session.avg_power_watts?.toFixed(0) || '—'} W
                </p>
              </div>
            </div>
            {session.max_power_watts && (
              <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-800 text-center">
                <p className="text-xs text-gray-400 dark:text-gray-500">Potência Máxima</p>
                <p className="text-sm font-semibold text-yellow-500">{session.max_power_watts.toFixed(0)} W</p>
              </div>
            )}
          </div>
        ))}
        {sessions.length === 0 && (
          <div className="text-center text-gray-400 dark:text-gray-500 py-8">
            <Car className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-700" />
            <p className="text-sm">Sem sessões de carregamento</p>
            <p className="text-xs mt-1">Os dados aparecem quando o carro carrega</p>
          </div>
        )}
      </div>
    </div>
  )
}
