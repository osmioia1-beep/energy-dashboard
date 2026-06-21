import React from 'react'
import { Link } from 'react-router-dom'
import { Activity, Zap, Clock, TrendingUp, ChevronRight } from 'lucide-react'

const DEVICE_ICONS = {
  'Bomba Furo': '💧',
  'Piscina': '🏊',
  'Maq. Lavar Roupa': '🧺',
  'Máq. Secar': '🌀',
  'Carregador': '⚡',
}

const DEVICE_COLORS = {
  'Bomba Furo': 'from-blue-600 to-blue-800',
  'Piscina': 'from-cyan-600 to-cyan-800',
  'Maq. Lavar Roupa': 'from-purple-600 to-purple-800',
  'Máq. Secar': 'from-orange-600 to-orange-800',
  'Carregador': 'from-green-600 to-green-800',
}

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

export default function DeviceCard({ device }) {
  const { name, stats } = device
  const icon = DEVICE_ICONS[name] || '🔌'
  const gradient = DEVICE_COLORS[name] || 'from-gray-600 to-gray-800'

  return (
    <Link
      to={`/device/${encodeURIComponent(name)}`}
      className={`block bg-gradient-to-br ${gradient} rounded-2xl p-4 text-white shadow-lg hover:scale-[1.02] transition-transform`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{icon}</span>
          <div>
            <h3 className="font-bold text-base">{name}</h3>
            <p className="text-xs text-white/60">{device.ip || '—'}</p>
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-white/40" />
      </div>

      {stats ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-white/60" />
            <div>
              <p className="text-xs text-white/60">Estado</p>
              <p className={`text-sm font-semibold ${stats.isOn ? 'text-green-300' : 'text-white/80'}`}>
                {stats.isOn ? 'Ligado' : 'Desligado'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-white/60" />
            <div>
              <p className="text-xs text-white/60">Potência</p>
              <p className="text-sm font-semibold">{stats.lastPower.toFixed(0)} W</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-white/60" />
            <div>
              <p className="text-xs text-white/60">Tempo total</p>
              <p className="text-sm font-semibold">{formatDuration(stats.totalDurationS)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-white/60" />
            <div>
              <p className="text-xs text-white/60">Energia</p>
              <p className="text-sm font-semibold">{formatEnergy(stats.totalEnergyWh)}</p>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-sm text-white/50 italic">Sem dados</p>
      )}
    </Link>
  )
}
