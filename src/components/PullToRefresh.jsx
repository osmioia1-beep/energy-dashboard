import React, { useState, useRef, useCallback } from 'react'
import { RefreshCw } from 'lucide-react'

export default function PullToRefresh({ onRefresh, children }) {
  const [pulling, setPulling] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const startY = useRef(0)

  const handleTouchStart = useCallback((e) => {
    startY.current = e.touches[0].clientY
  }, [])

  const handleTouchMove = useCallback((e) => {
    if (startY.current === 0) return
    const currentY = e.touches[0].clientY
    const diff = currentY - startY.current
    if (diff > 0 && window.scrollY === 0) {
      e.preventDefault()
      setPulling(true)
      setPullDistance(Math.min(diff * 0.4, 80))
    }
  }, [])

  const handleTouchEnd = useCallback(async () => {
    if (pullDistance > 50) {
      setRefreshing(true)
      try {
        await onRefresh()
      } finally {
        setRefreshing(false)
      }
    }
    setPulling(false)
    setPullDistance(0)
    startY.current = 0
  }, [pullDistance, onRefresh])

  return (
    <div
      className="h-full"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div
        className="flex flex-col items-center transition-all duration-200 overflow-hidden"
        style={{
          height: pulling ? Math.max(pullDistance, 40) : 0,
          opacity: pulling ? Math.min(pullDistance / 50, 1) : 0,
        }}
      >
        <RefreshCw className={`w-5 h-5 text-brand-500 mt-2 ${refreshing ? 'animate-spin' : ''}`} />
        <span className="text-xs text-gray-400 mt-0.5">
          {refreshing ? 'A atualizar...' : pullDistance > 50 ? 'Largar para atualizar' : 'Puxar para atualizar'}
        </span>
      </div>
      {children}
    </div>
  )
}
