import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Car, Zap, Clock, TrendingUp, Battery, Activity, Sun, Home } from 'lucide-react'
import { getV2CSessions, getV2CStats } from '../services/supabase'

function formatDuration(seconds) {
  if (!seconds) return '—'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function formatEnergy(wh) {
  if (!wh && wh !== 0) return '—'
  if (wh >= 1000) return `${(wh / 1000).toFixed(2)} kWh`
  return `${wh.toFixed(1)} Wh`
}

function formatTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function V2CPage() {
  const [sessions, setSessions] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    async function load() {
      try {
        const [sessData, statsData] = await Promise.all([
          getV2CSessions(20),
          getV2CStats(),
        ])
        setSessions(sessData)
        setStats(statsData)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    load()
    const dataInterval = setInterval(load, 30000)
    const clockInterval = setInterval(() => setNow(Date.now()), 1000)
    return () => { clearInterval(dataInterval); clearInterval(clockInterval) }
  }, [])

  // Find active session (no end_time)
  const activeSession = sessions.find(s => !s.end_time)
  const pastSessions = sessions.filter(s => s.end_time)

  // Parse snapshots for active session
  let activeSnapshots = []
  if (activeSession?.snapshots) {
    try {
      activeSnapshots = typeof activeSession.snapshots === 'string'
        ? JSON.parse(activeSession.snapshots)
        : activeSession.snapshots
    } catch (e) { activeSnapshots = [] }
  }

  // Calculate current session duration
  const currentDuration = activeSession?.start_time
    ? Math.round((now - new Date(activeSession.start_time).getTime()) / 1000)
    : null

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
        {activeSession && (
          <span className="ml-auto flex items-center gap-1.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-semibold px-2.5 py-1 rounded-full">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            A carregar
          </span>
        )}
      </div>

      {/* Active Session Card */}
      {activeSession && (
        <div className="bg-gradient-to-br from-green-600/90 to-teal-600/90 rounded-2xl p-5 text-white shadow-md">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Car className="w-5 h-5" />
              <span className="font-bold text-lg">{activeSession.carro || 'Carro'}</span>
            </div>
            <span className="text-sm text-white/80">
              Início: {formatTime(activeSession.start_time)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-white/20 rounded-xl p-3 text-center backdrop-blur-sm">
              <Zap className="w-5 h-5 mx-auto mb-1 text-yellow-300" />
              <p className="text-2xl font-bold">{activeSession.avg_power_watts?.toFixed(0) || '—'}</p>
              <p className="text-xs text-white/70">Watts (média)</p>
            </div>
            <div className="bg-white/20 rounded-xl p-3 text-center backdrop-blur-sm">
              <Battery className="w-5 h-5 mx-auto mb-1 text-blue-200" />
              <p className="text-2xl font-bold">{((activeSession.total_energy_wh || 0)).toFixed(2) + " kWh"}</p>
              <p className="text-xs text-white/70">Energia</p>
            </div>
            <div className="bg-white/20 rounded-xl p-3 text-center backdrop-blur-sm">
              <Clock className="w-5 h-5 mx-auto mb-1 text-purple-200" />
              <p className="text-2xl font-bold">{formatDuration(currentDuration)}</p>
              <p className="text-xs text-white/70">Duração</p>
            </div>
            <div className="bg-white/20 rounded-xl p-3 text-center backdrop-blur-sm">
              <Activity className="w-5 h-5 mx-auto mb-1 text-orange-200" />
              <p className="text-2xl font-bold">{activeSnapshots.length}</p>
              <p className="text-xs text-white/70">Snapshots</p>
            </div>
          </div>

          {/* Max power */}
          {activeSession.max_power_watts > 0 && (
            <div className="bg-white/20 rounded-lg p-2 text-center">
              <p className="text-xs text-white/60">Potência Máxima</p>
              <p className="text-lg font-bold text-yellow-300">{activeSession.max_power_watts.toFixed(0)} W</p>
            </div>
          )}
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-yellow-500" />
              <span className="text-xs text-gray-400 dark:text-gray-500">Total Sessões</span>
            </div>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{stats.totalSessions}</p>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800">
            <div className="flex items-center gap-2 mb-2">
              <Battery className="w-4 h-4 text-green-500" />
              <span className="text-xs text-gray-400 dark:text-gray-500">Energia Total</span>
            </div>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{(stats.totalEnergyWh || 0).toFixed(2) + " kWh"}</p>
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

      {/* Active Session Snapshots */}
      {activeSnapshots.length > 0 && (
        <>
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Snapshots — Sessão Ativa ({activeSnapshots.length})
          </h2>
          <div className="space-y-2">
            {[...activeSnapshots].reverse().map((snap, i) => (
              <div key={i} className="bg-white dark:bg-gray-900 rounded-xl p-3 border border-gray-200 dark:border-gray-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                    {formatTime(snap.time)}
                  </span>
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    #{activeSnapshots.length - i}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500">Potência</p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{snap.power?.toFixed(0)} W</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500">Energia</p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{((snap.energy || 0)).toFixed(2) + " kWh"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500">Casa</p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{snap.house_power?.toFixed(0)} W</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500">Intensidade</p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{snap.intensity} A</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Past Sessions */}
      <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
        Sessões Anteriores ({pastSessions.length})
      </h2>

      <div className="space-y-2">
        {pastSessions.map((session) => (
          <div key={session.id} className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Car className="w-4 h-4 text-brand-500" />
                <span className="text-sm font-medium text-gray-900 dark:text-white">{session.carro || 'Carro'}</span>
              </div>
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {formatDate(session.start_time)}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-xs text-gray-400 dark:text-gray-500">Energia</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{(session.total_energy_wh || 0).toFixed(2) + " kWh"}</p>
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
            {session.max_power_watts > 0 && (
              <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-800 text-center">
                <p className="text-xs text-gray-400 dark:text-gray-500">Potência Máxima</p>
                <p className="text-sm font-semibold text-yellow-500">{session.max_power_watts.toFixed(0)} W</p>
              </div>
            )}
          </div>
        ))}
        {pastSessions.length === 0 && !activeSession && (
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
