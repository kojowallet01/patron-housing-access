import React from 'react'
import Entrance from './pages/Entrance'
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
  const path = window.location.pathname.toLowerCase()
  const hasRegisterParam = window.location.search.includes('campus=')

  if (path === '/home') {
    return <Home />
  }

  if (path === '/register' || hasRegisterParam) {
    return <RegisterPage />
  }

  if (path === '/security') {
    return (
      <RoleGate
        role="security"
        targetPath="/security"
        title="Security access"
        subtitle="Unlock this campus security dashboard"
      >
        <Security />
      </RoleGate>
    )
  }

  if (path === '/campus-selector') {
    return <CampusSelector />
  }

  if (path === '/admin') {
    return (
      <RoleGate
        role="admin"
        targetPath="/admin"
        title="Admin access"
        subtitle="Unlock this campus admin dashboard"
      >
        <Admin />
      </RoleGate>
    )
  }

  if (path === '/reports/daily') {
    return <DailySignups />
  }

  if (path === '/reports/weekly') {
    return <WeeklySignups />
  }

  if (path === '/reports/monthly') {
    return <MonthlySignups />
  }

  if (path === '/entrance' || path === '/') {
    return <Entrance />
  }

  return <Entrance />
}

export default App
