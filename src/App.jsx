import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useState } from 'react'
import Entrance from './pages/Entrance'
import AccessQR from './pages/AccessQR'
import RegisterPage from './pages/RegisterPage'
import Security from './pages/Security'
import Home from './pages/Home'
import CampusSelector from './pages/CampusSelector'
import RoleGate from './pages/RoleGate'
import AdminLayout from './pages/admin/AdminLayout'
import Dashboard from './pages/admin/Dashboard'
import Students from './pages/admin/Students'
import Visitors from './pages/admin/Visitors'
import PasswordManager from './pages/admin/PasswordManager'
import Reports from './pages/admin/Reports'
import Settings from './pages/admin/Settings'
import DailySignups from './pages/reports/DailySignups'
import WeeklySignups from './pages/reports/WeeklySignups'
import MonthlySignups from './pages/reports/MonthlySignups'
import AllTimeSignups from './pages/reports/AllTimeSignups'
import ByPurpose from './pages/reports/ByPurpose'
import { toggleTheme } from './theme'
import ErrorBoundary from './ErrorBoundary'

function ThemeToggle() {
  const [theme, setTheme] = useState(document.documentElement.getAttribute('data-theme') || 'light')

  const handleClick = () => {
    setTheme(toggleTheme(theme))
  }

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={handleClick}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {theme === 'dark' ? (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4" />
          <line x1="12" y1="2" x2="12" y2="4" />
          <line x1="12" y1="20" x2="12" y2="22" />
          <line x1="4.93" y1="4.93" x2="6.34" y2="6.34" />
          <line x1="17.66" y1="17.66" x2="19.07" y2="19.07" />
          <line x1="2" y1="12" x2="4" y2="12" />
          <line x1="20" y1="12" x2="22" y2="12" />
          <line x1="4.93" y1="19.07" x2="6.34" y2="17.66" />
          <line x1="17.66" y1="6.34" x2="19.07" y2="4.93" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  )
}

function App() {
  return (
    <BrowserRouter>
      <ThemeToggle />
      <ErrorBoundary>
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
          <Route path="students" element={<Students />} />
          <Route path="visitors" element={<Visitors />} />
          <Route path="security" element={<PasswordManager />} />
          <Route path="reports" element={<Reports />} />
          <Route path="reports/daily" element={<DailySignups />} />
          <Route path="reports/weekly" element={<WeeklySignups />} />
          <Route path="reports/monthly" element={<MonthlySignups />} />
          <Route path="reports/all-time" element={<AllTimeSignups />} />
          <Route path="reports/by-purpose" element={<ByPurpose />} />
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
      </ErrorBoundary>
    </BrowserRouter>
  )
}

export default App
