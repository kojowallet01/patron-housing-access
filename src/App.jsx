import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Entrance from './pages/Entrance'
import AccessQR from './pages/AccessQR'
import RegisterPage from './pages/RegisterPage'
import Security from './pages/Security'
import Home from './pages/Home'
import CampusSelector from './pages/CampusSelector'
import RoleGate from './pages/RoleGate'
import AdminLayout from './pages/admin/AdminLayout'
import Dashboard from './pages/admin/Dashboard'
import Residents from './pages/admin/Residents'
import Visitors from './pages/admin/Visitors'
import PasswordManager from './pages/admin/PasswordManager'
import Reports from './pages/admin/Reports'
import Settings from './pages/admin/Settings'
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
              <AdminLayout />
            </RoleGate>
          )}
        >
          <Route index element={<Dashboard />} />
          <Route path="residents" element={<Residents />} />
          <Route path="visitors" element={<Visitors />} />
          <Route path="security" element={<PasswordManager />} />
          <Route path="reports" element={<Reports />} />
          <Route path="reports/daily" element={<DailySignups />} />
          <Route path="reports/weekly" element={<WeeklySignups />} />
          <Route path="reports/monthly" element={<MonthlySignups />} />
          <Route path="settings" element={<Settings />} />
        </Route>
        <Route path="/reports/daily" element={<Navigate to="/admin/reports/daily" replace />} />
        <Route path="/reports/weekly" element={<Navigate to="/admin/reports/weekly" replace />} />
        <Route path="/reports/monthly" element={<Navigate to="/admin/reports/monthly" replace />} />
        <Route path="/access" element={<AccessQR />} />
        <Route path="/entrance" element={<Entrance />} />
        <Route path="/" element={<Entrance />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
