import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Entrance from './pages/Entrance'
import AccessQR from './pages/AccessQR'
import RegisterPage from './pages/RegisterPage'
import Security from './pages/Security'
import Admin from './pages/admin/Admin'
import Home from './pages/Home'
import CampusSelector from './pages/CampusSelector'
import RoleGate from './pages/RoleGate'
import DailySignups from './pages/reports/DailySignups'
import WeeklySignups from './pages/reports/WeeklySignups'
import MonthlySignups from './pages/reports/MonthlySignups'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/home" element={<Home />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          path="/security"
          element={(
            <RoleGate
              role="security"
              title="Security access"
              subtitle="Unlock this campus security dashboard"
            >
              <Security />
            </RoleGate>
          )}
        />
        <Route path="/campus-selector" element={<CampusSelector />} />
        <Route
          path="/admin"
          element={(
            <RoleGate
              role="admin"
              title="Admin access"
              subtitle="Unlock this campus admin dashboard"
            >
              <Admin />
            </RoleGate>
          )}
        />
        <Route
          path="/reports/daily"
          element={(
            <RoleGate role="admin" title="Reports access" subtitle="Unlock admin reports">
              <DailySignups />
            </RoleGate>
          )}
        />
        <Route
          path="/reports/weekly"
          element={(
            <RoleGate role="admin" title="Reports access" subtitle="Unlock admin reports">
              <WeeklySignups />
            </RoleGate>
          )}
        />
        <Route
          path="/reports/monthly"
          element={(
            <RoleGate role="admin" title="Reports access" subtitle="Unlock admin reports">
              <MonthlySignups />
            </RoleGate>
          )}
        />
        <Route path="/access" element={<AccessQR />} />
        <Route path="/entrance" element={<Entrance />} />
        <Route path="/" element={<Entrance />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
