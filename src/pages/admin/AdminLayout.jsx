import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
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
  X,
  Database,
  TrendingUp
} from 'lucide-react'
import {
  API_URL,
  CAMPUS_INSTITUTE_NAME,
  setSelectedCampus,
  getSelectedCampus,
  CAMPUS_LIST
} from '../../config'
import { validateSession, logoutSession, clearSession } from '../../auth'

export const AdminContext = React.createContext(null)

const NAV_ITEMS = [
  { path: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true, bottom: true },
  { path: '/admin/students', label: 'Students', icon: Users, end: false, bottom: true },
  { path: '/admin/visitors', label: 'Visitors', icon: UserCheck, end: false, bottom: true },
  { path: '/admin/retention', label: 'Retention', icon: TrendingUp, end: false, bottom: false },
  { path: '/admin/security', label: 'Security', icon: ShieldCheck, end: false, bottom: true },
  { path: '/admin/reports', label: 'Reports', icon: BarChart3, end: false, bottom: true },
  { path: '/admin/settings', label: 'Settings', icon: Settings, end: false, bottom: false }
]

function AdminLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const [activeCampus, setActiveCampus] = useState(getSelectedCampus())
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [sessionChecked, setSessionChecked] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [dbStatus, setDbStatus] = useState(null)

  useEffect(() => {
    let active = true

    validateSession().then((session) => {
      if (!active) return
      if (!session.valid) {
        clearSession()
        navigate('/admin/login')
        return
      }
      setIsSuperAdmin(Boolean(session.isSuperAdmin))
      if (!session.isSuperAdmin && session.campus) {
        setActiveCampus(session.campus)
        setSelectedCampus(session.campus)
      }
      setSessionChecked(true)
    })

    return () => {
      active = false
    }
  }, [navigate])

  useEffect(() => {
    setMobileNavOpen(false)
    const current = getSelectedCampus()
    if (current && current !== activeCampus) {
      setActiveCampus(current)
    }
  }, [location.pathname])

  useEffect(() => {
    let active = true
    const checkHealth = () => {
      fetch(`${API_URL}/health`)
        .then((r) => r.json())
        .then((data) => { if (active) setDbStatus(data) })
        .catch(() => { if (active) setDbStatus({ configured: true, healthy: false, backend: 'supabase' }) })
    }
    checkHealth()
    const interval = setInterval(checkHealth, 30000)
    return () => { active = false; clearInterval(interval) }
  }, [])

  const refresh = useCallback(() => {
    setRefreshKey((key) => key + 1)
  }, [])

  const handleSwitchCampus = () => {
    navigate('/campus-selector')
  }

  const handleLogout = async () => {
    await logoutSession()
    navigate('/admin/login')
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
        <div className="admin-sidebar-db-status" style={{ color: dbStatus === null ? '#94a3b8' : dbStatus.healthy ? '#16a34a' : '#dc2626' }}>
          <Database size={12} strokeWidth={2} />
          <span>
            {dbStatus === null
              ? 'Checking...'
              : dbStatus.healthy
                ? `${dbStatus.backend === 'supabase' ? 'Supabase' : 'SQLite'}: Connected`
                : dbStatus.configured
                  ? 'Supabase: Offline'
                  : 'SQLite: Local'}
          </span>
        </div>
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
              {isSuperAdmin ? (
                <div className="admin-campus-dropdown-wrapper">
                  <select
                    className="admin-campus-select"
                    value={activeCampus}
                    onChange={(e) => {
                      const next = e.target.value
                      setActiveCampus(next)
                      setSelectedCampus(next)
                    }}
                    aria-label="Active Campus"
                  >
                    {CAMPUS_LIST.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <span className="admin-context-campus">{activeCampus}</span>
              )}
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

      <nav className="admin-bottom-nav" aria-label="Mobile navigation">
        {NAV_ITEMS.filter((item) => item.bottom !== false).map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.end}
            className={({ isActive }) => `admin-bottom-nav-item${isActive ? ' active' : ''}`}
          >
            <item.icon size={20} strokeWidth={2} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
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
