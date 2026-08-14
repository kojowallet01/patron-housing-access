import React, { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Building2,
  UserCircle,
  LogOut,
  RefreshCw,
  Info,
  Download,
  Database,
  ShieldCheck,
  QrCode,
  ExternalLink,
  Users,
  DoorOpen,
  CalendarDays,
  CalendarRange,
  History,
  Server,
  HardDrive,
  Clock,
  KeyRound,
  ChevronRight
} from 'lucide-react'
import { API_URL, getCampusAuthHeaders, CAMPUS_INSTITUTE_NAME } from '../../config'
import { useAdminContext } from './AdminLayout'
import { logoutSession } from '../../auth'

function Settings() {
  const { activeCampus, isSuperAdmin, refresh } = useAdminContext()
  const navigate = useNavigate()

  const [stats, setStats] = useState(null)
  const [systemInfo, setSystemInfo] = useState(null)
  const [qrCode, setQrCode] = useState(null)
  const [passwords, setPasswords] = useState(null)
  const [message, setMessage] = useState('')
  const [backingUp, setBackingUp] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const restoreInputRef = React.useRef(null)

  const loadStats = useCallback(async () => {
    try {
      const authHeaders = getCampusAuthHeaders(activeCampus)
      const res = await fetch(`${API_URL}/admin/stats`, { headers: authHeaders })
      if (res.ok) setStats(await res.json())
    } catch (error) {
      console.error('Stats error:', error)
    }
  }, [activeCampus])

  const loadSystemInfo = useCallback(async () => {
    try {
      const authHeaders = getCampusAuthHeaders(activeCampus)
      const res = await fetch(`${API_URL}/admin/system-info`, { headers: authHeaders })
      if (res.ok) setSystemInfo(await res.json())
    } catch (error) {
      console.error('System info error:', error)
    }
  }, [activeCampus])

  const loadQr = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/campus-qr?campus=${encodeURIComponent(activeCampus)}`)
      if (res.ok) setQrCode(await res.json())
    } catch (error) {
      console.error('QR error:', error)
    }
  }, [activeCampus])

  const loadPasswords = useCallback(async () => {
    if (!isSuperAdmin) return
    try {
      const authHeaders = getCampusAuthHeaders(activeCampus)
      const res = await fetch(`${API_URL}/super-admin/passwords`, { headers: authHeaders })
      if (res.ok) setPasswords(await res.json())
    } catch (error) {
      console.error('Password map error:', error)
    }
  }, [activeCampus, isSuperAdmin])

  useEffect(() => {
    loadStats()
    loadSystemInfo()
    loadQr()
    loadPasswords()
  }, [loadStats, loadSystemInfo, loadQr, loadPasswords])

  const handleBackup = async () => {
    setBackingUp(true)
    setMessage('')
    try {
      const authHeaders = getCampusAuthHeaders(activeCampus)
      const response = await fetch(`${API_URL}/admin/export`, { headers: authHeaders })
      if (!response.ok) throw new Error('Export failed')
      const data = await response.json()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `patron-housing-backup-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      setMessage('Backup downloaded successfully.')
    } catch (error) {
      console.error('Backup error:', error)
      setMessage('Unable to create backup. Please try again.')
    } finally {
      setBackingUp(false)
    }
  }

  const handleLogout = async () => {
    await logoutSession()
    window.location.href = '/'
  }

  const handleRestoreFile = async (e) => {
    const file = e.target.files && e.target.files[0]
    e.target.value = ''
    if (!file) return
    if (!window.confirm(`Restore from "${file.name}"? This will REPLACE all current students, tokens, and settings. This cannot be undone.`)) return
    setRestoring(true)
    setMessage('')
    try {
      const parsed = JSON.parse(await file.text())
      const authHeaders = getCampusAuthHeaders(activeCampus)
      const response = await fetch(`${API_URL}/admin/restore`, {
        method: 'POST',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(parsed)
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Restore failed')
      setMessage(data.message || 'Restore completed successfully.')
      refresh()
      loadStats()
      loadSystemInfo()
    } catch (error) {
      console.error('Restore error:', error)
      setMessage(`Unable to restore backup: ${error.message}`)
    } finally {
      setRestoring(false)
    }
  }

  const formatBytes = (bytes) => {
    if (!bytes) return '0 KB'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  const formatUptime = (seconds) => {
    if (seconds == null) return '--'
    const d = Math.floor(seconds / 86400)
    const h = Math.floor((seconds % 86400) / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    if (d > 0) return `${d}d ${h}h`
    if (h > 0) return `${h}h ${m}m`
    return `${m}m`
  }

  const statTiles = [
    { label: 'Total Students', value: stats?.totalStudents ?? '--', icon: Users, tone: 'indigo' },
    { label: "Today's Visits", value: stats?.todayVisits ?? '--', icon: DoorOpen, tone: 'emerald' },
    { label: 'This Week', value: stats?.thisWeekVisits ?? '--', icon: CalendarDays, tone: 'amber' },
    { label: 'This Month', value: stats?.thisMonthVisits ?? '--', icon: CalendarRange, tone: 'sky' },
    { label: 'All-Time Visits', value: stats?.totalVisits ?? '--', icon: History, tone: 'violet' }
  ]

  const storageLabel = systemInfo?.storage === 'supabase' ? 'Supabase (Postgres)' : 'Local SQLite'
  const durable = systemInfo?.storage === 'supabase'

  const roleStatuses = [
    { role: 'admin', label: 'Admin' },
    { role: 'security', label: 'Security' },
    { role: 'superAdmin', label: 'Super Admin' }
  ]

  return (
    <div className="admin-page-container">
      <div className="admin-page-heading">
        <div>
          <h1 className="admin-page-title">Settings</h1>
          <p className="admin-page-subtitle">App preferences, data, security, and system details</p>
        </div>
      </div>

      {message && (
        <div className="admin-message-bar">
          <Info size={18} strokeWidth={2} />
          {message}
        </div>
      )}

      <div className="admin-stats-grid">
        {statTiles.map((tile) => (
          <div key={tile.label} className={`admin-stat-card admin-stat-${tile.tone}`}>
            <div className="admin-stat-icon">
              <tile.icon size={22} strokeWidth={2} />
            </div>
            <div className="admin-stat-meta">
              <span className="admin-stat-label">{tile.label}</span>
              <span className="admin-stat-value">{tile.value}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="admin-settings-grid">
        <div className="admin-card admin-settings-card">
          <div className="admin-card-header">
            <div className="admin-card-title">
              <UserCircle size={18} strokeWidth={2} />
              <h2>Session & Account</h2>
            </div>
          </div>
          <div className="admin-settings-row">
            <div>
              <span className="admin-settings-label">Active Campus</span>
              <span className="admin-settings-value">
                <Building2 size={15} strokeWidth={2} />
                {activeCampus}
              </span>
            </div>
            <div>
              <span className="admin-settings-label">Role</span>
              <span className="admin-settings-value">
                {isSuperAdmin ? 'Super Admin' : 'Admin'}
              </span>
            </div>
            <div>
              <span className="admin-settings-label">Institute</span>
              <span className="admin-settings-value">{CAMPUS_INSTITUTE_NAME}</span>
            </div>
          </div>
        </div>

        <div className="admin-card admin-settings-card">
          <div className="admin-card-header">
            <div className="admin-card-title">
              <QrCode size={18} strokeWidth={2} />
              <h2>Entrance QR</h2>
            </div>
            <span className="admin-card-badge">{activeCampus}</span>
          </div>
          <div className="admin-settings-qr">
            {qrCode ? (
              <>
                <img src={qrCode.qrCodeUrl} alt={`${activeCampus} entrance QR code`} className="admin-settings-qr-img" />
                <p className="admin-settings-qr-note">
                  Students scan this QR at the entrance to register and get their access token.
                </p>
                <a
                  href={qrCode.registrationUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="admin-btn admin-btn-outline"
                >
                  <ExternalLink size={16} strokeWidth={2} />
                  Open Registration Link
                </a>
              </>
            ) : (
              <div className="admin-empty-state">
                <QrCode size={28} strokeWidth={1.5} />
                <p>Loading entrance QR...</p>
              </div>
            )}
          </div>
        </div>

        <div className="admin-card admin-settings-card">
          <div className="admin-card-header">
            <div className="admin-card-title">
              <Database size={18} strokeWidth={2} />
              <h2>Data & Backup</h2>
            </div>
          </div>
          <div className="admin-settings-row">
            <div>
              <span className="admin-settings-label">Students</span>
              <span className="admin-settings-value">{systemInfo?.counts?.students ?? '--'}</span>
            </div>
            <div>
              <span className="admin-settings-label">Access Tokens</span>
              <span className="admin-settings-value">{systemInfo?.counts?.tokens ?? '--'}</span>
            </div>
            <div>
              <span className="admin-settings-label">Database Size</span>
              <span className="admin-settings-value">
                <HardDrive size={15} strokeWidth={2} />
                {formatBytes(systemInfo?.dbSizeBytes)}
              </span>
            </div>
          </div>
          <div className="admin-settings-actions">
            <button
              type="button"
              className="admin-btn admin-btn-primary"
              onClick={handleBackup}
              disabled={backingUp}
            >
              <Download size={16} strokeWidth={2} />
              {backingUp ? 'Creating backup...' : 'Download Full Backup'}
            </button>
            {isSuperAdmin && (
              <>
                <input
                  ref={restoreInputRef}
                  type="file"
                  accept="application/json,.json"
                  onChange={handleRestoreFile}
                  style={{ display: 'none' }}
                />
                <button
                  type="button"
                  className="admin-btn admin-btn-danger"
                  onClick={() => restoreInputRef.current && restoreInputRef.current.click()}
                  disabled={restoring}
                >
                  <RefreshCw size={16} strokeWidth={2} />
                  {restoring ? 'Restoring...' : 'Restore Backup'}
                </button>
              </>
            )}
          </div>
          {isSuperAdmin && (
            <p className="admin-settings-hint">
              Restoring a backup replaces all existing data. Only super admins can restore.
            </p>
          )}
        </div>

        <div className="admin-card admin-settings-card">
          <div className="admin-card-header">
            <div className="admin-card-title">
              <Server size={18} strokeWidth={2} />
              <h2>System</h2>
            </div>
          </div>
          <div className="admin-settings-row">
            <div>
              <span className="admin-settings-label">Storage</span>
              <span className="admin-settings-value">
                <Database size={15} strokeWidth={2} />
                {storageLabel}
                <span className={`admin-status-pill ${durable ? 'admin-status-online' : 'admin-status-warning'}`}>
                  <span className="admin-status-dot"></span>
                  {durable ? 'Durable' : 'Ephemeral'}
                </span>
              </span>
            </div>
            <div>
              <span className="admin-settings-label">Uptime</span>
              <span className="admin-settings-value">
                <Clock size={15} strokeWidth={2} />
                {formatUptime(systemInfo?.uptimeSeconds)}
              </span>
            </div>
            <div>
              <span className="admin-settings-label">Server Started</span>
              <span className="admin-settings-value">
                {systemInfo?.startedAt ? new Date(systemInfo.startedAt).toLocaleString() : '--'}
              </span>
            </div>
          </div>
          {!durable && (
            <p className="admin-settings-hint">
              Data is stored in a local SQLite file. On cloud deployments without Supabase, this storage
              can be wiped on redeploy — use the backup button to export your data.
            </p>
          )}
        </div>

        <div className="admin-card admin-settings-card">
          <div className="admin-card-header">
            <div className="admin-card-title">
              <ShieldCheck size={18} strokeWidth={2} />
              <h2>Security & Passwords</h2>
            </div>
          </div>
          {isSuperAdmin ? (
            <>
              <div className="admin-settings-row">
                {roleStatuses.map(({ role, label }) => {
                  const set = Boolean(passwords?.[role]?.[activeCampus])
                  return (
                    <div key={role}>
                      <span className="admin-settings-label">{label}</span>
                      <span className="admin-settings-value">
                        <KeyRound size={15} strokeWidth={2} />
                        <span className={`admin-status-pill ${set ? 'admin-status-online' : 'admin-status-neutral'}`}>
                          <span className="admin-status-dot"></span>
                          {set ? 'Set' : 'Not set'}
                        </span>
                      </span>
                    </div>
                  )
                })}
              </div>
              <div className="admin-settings-actions">
                <button type="button" className="admin-btn admin-btn-secondary" onClick={() => navigate('/admin/security')}>
                  <ShieldCheck size={16} strokeWidth={2} />
                  Manage Passwords
                </button>
              </div>
            </>
          ) : (
            <p className="admin-settings-hint">
              Only super admins can view or change role passwords. Contact a super admin if you need a
              password reset.
            </p>
          )}
        </div>

        <div className="admin-card admin-settings-card">
          <div className="admin-card-header">
            <div className="admin-card-title">
              <RefreshCw size={18} strokeWidth={2} />
              <h2>Quick Actions</h2>
            </div>
          </div>
          <div className="admin-settings-actions">
            <button type="button" className="admin-btn admin-btn-primary" onClick={refresh}>
              <RefreshCw size={16} strokeWidth={2} />
              Refresh Dashboard Data
            </button>
            <Link to="/admin/students" className="admin-settings-link">
              <Users size={16} strokeWidth={2} />
              Manage Students
              <ChevronRight size={16} strokeWidth={2} />
            </Link>
            <Link to="/admin/reports" className="admin-settings-link">
              <History size={16} strokeWidth={2} />
              View Reports
              <ChevronRight size={16} strokeWidth={2} />
            </Link>
            {isSuperAdmin && (
              <button
                type="button"
                className="admin-btn admin-btn-secondary"
                onClick={() => navigate('/campus-selector')}
              >
                <Building2 size={16} strokeWidth={2} />
                Switch Campus
              </button>
            )}
            <button type="button" className="admin-btn admin-btn-danger" onClick={handleLogout}>
              <LogOut size={16} strokeWidth={2} />
              Log Out
            </button>
          </div>
        </div>

        <div className="admin-card admin-settings-card">
          <div className="admin-card-header">
            <div className="admin-card-title">
              <Info size={18} strokeWidth={2} />
              <h2>About</h2>
            </div>
          </div>
          <p className="admin-settings-about">
            {CAMPUS_INSTITUTE_NAME} Access Control — manage students, visitors, and security access across
            your campuses. Report issues or request features at the front desk.
          </p>
          <span className="admin-settings-version">Version 2.0</span>
        </div>
      </div>
    </div>
  )
}

export default Settings
