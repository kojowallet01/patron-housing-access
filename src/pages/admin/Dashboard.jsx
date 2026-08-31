import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Users,
  UserCheck,
  DoorOpen,
  CalendarDays,
  CalendarRange,
  History,
  Activity,
  Server,
  ShieldCheck,
  Clock,
  ChevronRight,
  BarChart3,
  CalendarCheck,
  FileText,
  UserPlus,
  CheckCircle2,
  Download,
  QrCode,
  PieChart,
  BarChart2
} from 'lucide-react'
import { API_URL, getCampusAuthHeaders } from '../../config'
import { useAdminContext } from './AdminLayout'

const HOUR_LABELS = ['12a','1a','2a','3a','4a','5a','6a','7a','8a','9a','10a','11a','12p','1p','2p','3p','4p','5p','6p','7p','8p','9p','10p','11p']

function hourLabel(hour) {
  return HOUR_LABELS[hour] || ''
}

function DonutChart({ data, colors, total }) {
  const size = 200
  const stroke = 30
  const radius = (size - stroke) / 2
  const cx = size / 2
  const cy = size / 2
  const circumference = 2 * Math.PI * radius

  let cumulative = 0

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="admin-donut">
      <circle className="admin-donut-track" cx={cx} cy={cy} r={radius} fill="none" strokeWidth={stroke} />
      {total > 0 &&
        data.map((slice, i) => {
          const fraction = slice.value / total
          const dash = fraction * circumference
          const offset = circumference / 4 - cumulative * circumference
          cumulative += fraction
          return (
            <circle
              key={slice.label}
              className="admin-donut-segment"
              cx={cx}
              cy={cy}
              r={radius}
              fill="none"
              stroke={colors[i % colors.length]}
              strokeWidth={stroke}
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={offset}
            />
          )
        })}
      <text x={cx} y={cy - 8} textAnchor="middle" className="admin-donut-center-value">
        {total}
      </text>
      <text x={cx} y={cy + 18} textAnchor="middle" className="admin-donut-center-label">
        Visits
      </text>
    </svg>
  )
}

function Dashboard() {
  const { activeCampus, refreshKey } = useAdminContext()
  const [stats, setStats] = useState(null)
  const [recentActivity, setRecentActivity] = useState([])
  const [todayVisits, setTodayVisits] = useState([])
  const [allVisits, setAllVisits] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [qrBusy, setQrBusy] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const authHeaders = getCampusAuthHeaders(activeCampus)
      const [statsRes, visitsRes, todayRes] = await Promise.all([
        fetch(`${API_URL}/admin/stats`, { headers: authHeaders }),
        fetch(`${API_URL}/admin/visits?range=all`, { headers: authHeaders }),
        fetch(`${API_URL}/admin/visits?range=day`, { headers: authHeaders })
      ])

      if (!statsRes.ok || !visitsRes.ok || !todayRes.ok) {
        throw new Error('Dashboard request failed')
      }

      const statsData = await statsRes.json()
      const visitsData = await visitsRes.json()
      const todayData = await todayRes.json()

      setStats(statsData)
      setRecentActivity((visitsData.students || []).slice(0, 10))
      setAllVisits(visitsData.students || [])
      setTodayVisits(todayData.students || [])
      setError('')
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
      setError('Unable to load dashboard data. The connection or session may have expired.')
    } finally {
      setLoading(false)
    }
  }, [activeCampus])

  useEffect(() => {
    fetchData()
  }, [fetchData, refreshKey])

  useEffect(() => {
    const interval = setInterval(fetchData, 5000)
    return () => clearInterval(interval)
  }, [fetchData])

  const handleBackup = async () => {
    try {
      const authHeaders = getCampusAuthHeaders(activeCampus)
      const response = await fetch(`${API_URL}/admin/export`, { headers: authHeaders })
      if (!response.ok) throw new Error('Export failed')
      const data = await response.json()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `aifsp-backup-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Backup error:', error)
      window.alert('Unable to create backup. Please try again.')
    }
  }

  const statCards = [
    { label: 'Total Students', value: stats?.totalStudents ?? '--', icon: Users, tone: 'indigo', path: '/admin/students' },
    { label: "Today's Visits", value: stats?.todayVisits ?? '--', icon: DoorOpen, tone: 'emerald', path: '/admin/visitors' },
    { label: 'This Week', value: stats?.thisWeekVisits ?? '--', icon: CalendarDays, tone: 'amber', path: '/admin/visitors' },
    { label: 'This Month', value: stats?.thisMonthVisits ?? '--', icon: CalendarRange, tone: 'sky', path: '/admin/visitors' },
    { label: 'All-Time Visits', value: stats?.totalVisits ?? '--', icon: History, tone: 'violet', path: '/admin/visitors' }
  ]

  const chartData = useMemo(() => {
    const hours = Array(24).fill(0)
    todayVisits.forEach((v) => {
      const h = new Date(v.used_at).getHours()
      hours[h] += 1
    })

    const purposeMap = {}
    allVisits.forEach((v) => {
      const p = v.purpose || 'Not specified'
      purposeMap[p] = (purposeMap[p] || 0) + 1
    })
    const purposes = Object.entries(purposeMap)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6)
    const purposeTotal = purposes.reduce((sum, p) => sum + p.value, 0)

    let dayBuckets = Array(7).fill(0)
    const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    allVisits.forEach((v) => {
      dayBuckets[new Date(v.used_at).getDay()] += 1
    })

    return { hours, purposes, purposeTotal, dayBuckets, dayLabels }
  }, [todayVisits, allVisits])

  const maxHourCount = Math.max(...chartData.hours, 1)
  const maxDayCount = Math.max(...chartData.dayBuckets, 1)

  const PIE_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#3b82f6', '#ec4899', '#8b5cf6']

  const handleDownloadQr = async () => {
    try {
      setQrBusy(true)
      const authHeaders = getCampusAuthHeaders(activeCampus)
      const res = await fetch(`${API_URL}/campus-qr?campus=${encodeURIComponent(activeCampus)}`, { headers: authHeaders })
      if (!res.ok) throw new Error('QR fetch failed')
      const data = await res.json()
      const { qrCodeUrl } = data

      const img = await new Promise((resolve, reject) => {
        const image = new Image()
        image.onload = () => resolve(image)
        image.onerror = reject
        image.src = qrCodeUrl
      })

      const canvas = document.createElement('canvas')
      canvas.width = 1200
      canvas.height = 1600
      const ctx = canvas.getContext('2d')

      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      ctx.fillStyle = '#831843'
      ctx.fillRect(0, 0, canvas.width, 240)

      ctx.fillStyle = '#ffffff'
      ctx.textAlign = 'center'
      ctx.font = 'bold 46px Arial, sans-serif'
      ctx.fillText('AIFSP', 600, 110)
      ctx.font = '22px Arial, sans-serif'
      ctx.fillText(`${activeCampus} Campus`, 600, 160)

      const qrSize = 720
      ctx.drawImage(img, (canvas.width - qrSize) / 2, 320, qrSize, qrSize)

      ctx.fillStyle = '#111827'
      ctx.font = 'bold 40px Arial, sans-serif'
      ctx.fillText('Scan to Get Access', 600, 1140)

      ctx.font = '26px Arial, sans-serif'
      ctx.fillStyle = '#475569'
      ctx.fillText('Opening hours: 08:00 - 22:00', 600, 1200)
      ctx.fillText('Show your access code to security after scanning.', 600, 1250)

      const footerY = 1480
      ctx.fillStyle = '#831843'
      ctx.fillRect(0, footerY - 40, canvas.width, 2)

      const url = canvas.toDataURL('image/png')
      const link = document.createElement('a')
      link.href = url
      link.download = `entrance-qr-${activeCampus.replace(/\s+/g, '-').toLowerCase()}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (error) {
      console.error('QR download error:', error)
      window.alert('Unable to download QR. Please try again.')
    } finally {
      setQrBusy(false)
    }
  }

  const reportItems = [
    { title: 'Daily Signups', path: '/admin/reports/daily', desc: "Today's visitor signups", icon: CalendarCheck },
    { title: 'Weekly Signups', path: '/admin/reports/weekly', desc: 'Visitors over the past week', icon: BarChart3 },
    { title: 'Monthly Signups', path: '/admin/reports/monthly', desc: 'Signups for this month', icon: FileText }
  ]

  if (loading) {
    return (
      <div className="admin-page-container">
        <div className="admin-loading-card">Loading dashboard...</div>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="admin-page-container">
        <div className="admin-loading-card">
          <p>{error || 'Unable to load dashboard data.'}</p>
          <button type="button" className="admin-btn admin-btn-primary" onClick={fetchData} style={{ marginTop: '12px' }}>
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="admin-page-container">
      <div className="admin-page-heading">
        <div>
          <h1 className="admin-page-title">Dashboard</h1>
          <p className="admin-page-subtitle">Overview of campus activity and visitor flow</p>
        </div>
        <div className="admin-heading-actions">
          <button type="button" className="admin-btn admin-btn-secondary" onClick={handleDownloadQr} disabled={qrBusy}>
            <QrCode size={16} strokeWidth={2} />
            {qrBusy ? 'Generating...' : 'Download Entrance QR'}
          </button>
          <button type="button" className="admin-btn admin-btn-secondary" onClick={handleBackup}>
            <Download size={16} strokeWidth={2} />
            Backup Data
          </button>
        </div>
      </div>

      <div className="admin-stats-grid">
        {statCards.map((card) => (
          <Link key={card.label} to={card.path} className={`admin-stat-card admin-stat-${card.tone}`} title={`View ${card.label}`}>
            <div className="admin-stat-icon">
              <card.icon size={22} strokeWidth={2} />
            </div>
            <div className="admin-stat-meta">
              <span className="admin-stat-label">{card.label}</span>
              <span className="admin-stat-value">{card.value}</span>
            </div>
          </Link>
        ))}
      </div>

      <div className="admin-charts-grid">
        <div className="admin-card admin-chart-card">
          <div className="admin-card-header">
            <div className="admin-card-title">
              <BarChart2 size={18} strokeWidth={2} />
              <h2>Visits by Hour</h2>
            </div>
            <span className="admin-card-badge">Today</span>
          </div>
          <div className="admin-bar-chart">
            {chartData.hours.map((count, hour) => (
              <div className="admin-bar-col" key={hour} title={`${hourLabel(hour)} — ${count}`}>
                <div className="admin-bar-track">
                  <div
                    className="admin-bar-fill"
                    style={{ height: `${Math.max((count / maxHourCount) * 100, count > 0 ? 4 : 1)}%` }}
                  />
                </div>
                <span className="admin-bar-count">{count > 0 ? count : ''}</span>
              </div>
            ))}
          </div>
          <div className="admin-bar-axis">
            {[0, 6, 12, 18, 23].map((h) => (
              <span key={h}>{hourLabel(h)}</span>
            ))}
          </div>
        </div>

        <div className="admin-card admin-chart-card">
          <div className="admin-card-header">
            <div className="admin-card-title">
              <PieChart size={18} strokeWidth={2} />
              <h2>Visits by Purpose</h2>
            </div>
            <span className="admin-card-badge">All time</span>
          </div>
          {chartData.purposes.length === 0 ? (
            <div className="admin-empty-state">
              <p>No visit data yet</p>
            </div>
          ) : (
            <div className="admin-pie-block">
              <DonutChart data={chartData.purposes} colors={PIE_COLORS} total={chartData.purposeTotal} />
              <div className="admin-pie-legend">
                {chartData.purposes.map((p, i) => (
                  <div className="admin-pie-legend-item" key={p.label}>
                    <span className="admin-pie-legend-dot" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="admin-pie-legend-label">{p.label}</span>
                    <span className="admin-pie-legend-value">{p.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="admin-card admin-chart-card admin-chart-card-wide">
          <div className="admin-card-header">
            <div className="admin-card-title">
              <CalendarDays size={18} strokeWidth={2} />
              <h2>Visits by Day of Week</h2>
            </div>
            <span className="admin-card-badge">All time</span>
          </div>
          <div className="admin-dow-chart">
            {chartData.dayLabels.map((label, i) => (
              <div className="admin-dow-col" key={label} title={`${label} — ${chartData.dayBuckets[i]}`}>
                <div className="admin-dow-track">
                  <div
                    className="admin-dow-fill"
                    style={{ height: `${Math.max((chartData.dayBuckets[i] / maxDayCount) * 100, chartData.dayBuckets[i] > 0 ? 4 : 1)}%` }}
                  />
                </div>
                <span className="admin-dow-label">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="admin-layout-two-col">
        <div className="admin-col-main">
          <div className="admin-card">
            <div className="admin-card-header">
              <div className="admin-card-title">
                <Activity size={18} strokeWidth={2} />
                <h2>Reports</h2>
              </div>
              <span className="admin-card-badge">Quick access</span>
            </div>
            <div className="admin-report-list">
              {reportItems.map((item) => (
                <Link key={item.path} to={item.path} className="admin-report-link">
                  <div className="admin-report-link-icon">
                    <item.icon size={20} strokeWidth={2} />
                  </div>
                  <div className="admin-report-link-text">
                    <span className="admin-report-link-title">{item.title}</span>
                    <span className="admin-report-link-desc">{item.desc}</span>
                  </div>
                  <ChevronRight size={18} strokeWidth={2} className="admin-report-link-arrow" />
                </Link>
              ))}
            </div>
          </div>

          <div className="admin-card">
            <div className="admin-card-header">
              <div className="admin-card-title">
                <Server size={18} strokeWidth={2} />
                <h2>System Status</h2>
              </div>
              <span className="admin-status-pill admin-status-online">
                <span className="admin-status-dot"></span>
                Operational
              </span>
            </div>
            <div className="admin-status-grid">
              <div className="admin-status-item">
                <span className="admin-status-item-label">
                  <ShieldCheck size={16} strokeWidth={2} />
                  Entrance QR
                </span>
                <span className="admin-status-pill admin-status-online">
                  <span className="admin-status-dot"></span>
                  Active
                </span>
              </div>
              <div className="admin-status-item">
                <span className="admin-status-item-label">
                  <UserCheck size={16} strokeWidth={2} />
                  Security Station
                </span>
                <span className="admin-status-pill admin-status-online">
                  <span className="admin-status-dot"></span>
                  Online
                </span>
              </div>
              <div className="admin-status-item">
                <span className="admin-status-item-label">
                  <Users size={16} strokeWidth={2} />
                  Data Sync
                </span>
                <span className="admin-status-pill admin-status-online">
                  <span className="admin-status-dot"></span>
                  Synced
                </span>
              </div>
              <div className="admin-status-item">
                <span className="admin-status-item-label">
                  <Clock size={16} strokeWidth={2} />
                  Last refresh
                </span>
                <span className="admin-status-pill admin-status-neutral">
                  {new Date().toLocaleTimeString()}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="admin-col-side">
          <div className="admin-card admin-activity-card">
            <div className="admin-card-header">
              <div className="admin-card-title">
                <Activity size={18} strokeWidth={2} />
                <h2>Recent Activity</h2>
              </div>
              <span className="admin-card-badge">{recentActivity.length}</span>
            </div>
            <div className="admin-activity-feed">
              {recentActivity.length === 0 ? (
                <div className="admin-empty-state">
                  <CheckCircle2 size={28} strokeWidth={1.5} />
                  <p>No check-ins recorded yet</p>
                  <p className="admin-empty-state-sub">Visitors will appear here as they sign in.</p>
                </div>
              ) : (
                recentActivity.map((activity, index) => (
                  <div key={index} className="admin-activity-item">
                    <div className="admin-activity-avatar">
                      {(activity.name || 'V').charAt(0).toUpperCase()}
                    </div>
                    <div className="admin-activity-body">
                      <div className="admin-activity-top">
                        <span className="admin-activity-name">{activity.name}</span>
                        <span className="admin-activity-badge">Check-in</span>
                      </div>
                      <div className="admin-activity-time">{new Date(activity.used_at).toLocaleTimeString()}</div>
                      <div className="admin-activity-purpose">
                        <UserPlus size={13} strokeWidth={2} />
                        {activity.purpose || 'Checked in'}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
