import React from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import DeviceDetail from './pages/DeviceDetail'
import V2CPage from './pages/V2CPage'

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="device/:name" element={<DeviceDetail />} />
          <Route path="v2c" element={<V2CPage />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
