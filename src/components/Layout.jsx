import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { LayoutDashboard, Zap, Car } from 'lucide-react'

export default function Layout({ children }) {
  const loc = useLocation()
  const isActive = (path) => {
    if (path === '/') return loc.pathname === '/'
    return loc.pathname.startsWith(path)
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center gap-3">
        <Zap className="w-6 h-6 text-brand-500" />
        <h1 className="text-lg font-bold text-white">Energy Dashboard</h1>
      </header>

      {/* Content */}
      <main className="flex-1 p-4 pb-20">
        {children}
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 flex">
        <Link
          to="/"
          className={`flex-1 flex flex-col items-center py-3 text-xs gap-1 transition-colors ${
            isActive('/') ? 'text-brand-500' : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span>Dashboard</span>
        </Link>
        <Link
          to="/v2c"
          className={`flex-1 flex flex-col items-center py-3 text-xs gap-1 transition-colors ${
            isActive('/v2c') ? 'text-brand-500' : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          <Car className="w-5 h-5" />
          <span>V2C</span>
        </Link>
      </nav>
    </div>
  )
}
