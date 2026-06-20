import React from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { LayoutDashboard, Zap, Car, Sun, Moon } from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'

export default function Layout() {
  const loc = useLocation()
  const { dark, toggle } = useTheme()
  const isActive = (path) => {
    if (path === '/') return loc.pathname === '/'
    return loc.pathname.startsWith(path)
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3 flex items-center gap-3">
        <Zap className="w-6 h-6 text-brand-500" />
        <h1 className="text-lg font-bold text-gray-900 dark:text-white flex-1">Energy Dashboard</h1>
        <button
          onClick={toggle}
          className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-label="Toggle theme"
        >
          {dark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
      </header>

      {/* Content */}
      <main className="flex-1 p-4 pb-20">
        <Outlet />
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 flex">
        <Link
          to="/"
          className={`flex-1 flex flex-col items-center py-3 text-xs gap-1 transition-colors ${
            isActive('/') ? 'text-brand-500' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
          }`}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span>Dashboard</span>
        </Link>
        <Link
          to="/v2c"
          className={`flex-1 flex flex-col items-center py-3 text-xs gap-1 transition-colors ${
            isActive('/v2c') ? 'text-brand-500' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
          }`}
        >
          <Car className="w-5 h-5" />
          <span>V2C</span>
        </Link>
      </nav>
    </div>
  )
}
