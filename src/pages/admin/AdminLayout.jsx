import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  UserCheck,
  ShieldCheck,
  BarChart3,
  Settings,
  RefreshCw,
  ArrowLeftRight,
  LogOut,
  Building2,
  Menu,
  X
} from 'lucide-react'
import { CAMPUS_INSTITUTE_NAME, setSelectedCampus, getSelectedCampus } from '../../config'
import { validateSession, logoutSession } from '../../auth'

export const AdminContext = React.createContext(null)

const NAV_ITEMS = [
  { path: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { path: '/admin/students', label: 'Students', icon: Users, end: false },
  { path: '/admin/visitors', label: 'Visitors', icon: UserCheck, end: false },
  { path: '/admin/security', label: 'Security', icon: ShieldCheck, end: false },
  { path: '/admin/reports', label: 'Reports', icon: BarChart3, end: false },
  { path: '/admin/settings', label: 'Settings', icon: Settings, end: false }
]

function AdminLayout() {
  const [activeCampus, setActiveCampus] = useState(getSelectedCampus())
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [sessionChecked, setSessionChecked] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    let active = true

    validateSession().then((session) => {
      if (!active) return
      if (session.valid) {
        setIsSuperAdmin(Boolean(session.isSuperAdmin))
        if (!session.isSuperAdmin && session.campus) {
          setActiveCampus(session.campus)
          setSelectedCampus(session.campus)
        }
      }
      setSessionChecked(true)
    })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    setMobileNavOpen(false)
  }, [location.pathname])

  const refresh = useCallback(() => {
    setRefreshKey((key) => key + 1)
  }, [])

  const handleSwitchCampus = () => {
    window.location.href = '/campus-selector'
  }

  const handleLogout = async () => {
    await logoutSession()
    window.location.href = '/'
  }

  const contextValue = useMemo(
    () => ({ activeCampus, isSuperAdmin, refreshKey, refresh }),
    [activeCampus, isSuperAdmin, refreshKey, refresh]
  )

  if (!sessionChecked) {
    return (
      <div className="admin-shell">
        <div className="admin-loading">Loading workspace...</div>
      </div>
    )
  }

  const sidebarContent = (
    <div className="admin-sidebar-inner">
      <div className="admin-sidebar-brand">
        <div className="admin-sidebar-logo">
          <img src="/logo.png" alt="" />
        </div>
        <div className="admin-sidebar-brand-text">
          <span className="admin-sidebar-brand-name">{CAMPUS_INSTITUTE_NAME}</span>
          <span className="admin-sidebar-brand-sub">Faculty Student Portal</span>
        </div>
      </div>

      <nav className="admin-nav" aria-label="Admin navigation">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.end}
            className={({ isActive }) => `admin-nav-item${isActive ? ' active' : ''}`}
          >
            <item.icon size={18} strokeWidth={2} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="admin-sidebar-footer">
        <button type="button" className="admin-nav-item admin-nav-logout" onClick={handleLogout}>
          <LogOut size={18} strokeWidth={2} />
          <span>Log out</span>
        </button>
        <div className="admin-sidebar-version">v1.0 • Enterprise</div>
      </div>
    </div>
  )

  return (
    <div className="admin-shell">
      <aside className={`admin-sidebar${mobileNavOpen ? ' mobile-open' : ''}`}>
        {sidebarContent}
      </aside>

      {mobileNavOpen && (
        <div className="admin-sidebar-backdrop" onClick={() => setMobileNavOpen(false)} />
      )}

      <div className="admin-main">
        <header className="admin-topbar">
          <div className="admin-topbar-left">
            <button
              type="button"
              className="admin-menu-toggle"
              onClick={() => setMobileNavOpen((open) => !open)}
              aria-label="Toggle navigation"
            >
              {mobileNavOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <div className="admin-context">
              <span className="admin-context-org">
                <Building2 size={16} strokeWidth={2} />
                {CAMPUS_INSTITUTE_NAME}
              </span>
              <span className="admin-context-sep">•</span>
              <span className="admin-context-campus">{activeCampus}</span>
            </div>
          </div>

          <div className="admin-topbar-actions">
            <div className="live-indicator admin-live-indicator">
              <span className="pulse-dot"></span>
              <span>Live</span>
            </div>
            {isSuperAdmin && (
              <button type="button" className="admin-btn admin-btn-outline" onClick={handleSwitchCampus}>
                <ArrowLeftRight size={16} strokeWidth={2} />
                Switch Campus
              </button>
            )}
            <button type="button" className="admin-btn admin-btn-primary" onClick={refresh}>
              <RefreshCw size={16} strokeWidth={2} />
              Refresh
            </button>
          </div>
        </header>

        <main className="admin-content-area">
          <AdminContext.Provider value={contextValue}>
            <Outlet />
          </AdminContext.Provider>
        </main>
      </div>
    </div>
  )
}

export default AdminLayout

export function useAdminContext() {
  const context = React.useContext(AdminContext)
  if (!context) {
    throw new Error('useAdminContext must be used within AdminLayout')
  }
  return context
}
