import React, { useState, useEffect, useCallback } from 'react'
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
  CheckCircle2
} from 'lucide-react'
import { API_URL, getCampusAuthHeaders } from '../../config'
import { useAdminContext } from './AdminLayout'

function Dashboard() {
  const { activeCampus, isSuperAdmin, refreshKey } = useAdminContext()
  const [stats, setStats] = useState(null)
  const [recentActivity, setRecentActivity] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const authHeaders = getCampusAuthHeaders(activeCampus)
      const [statsRes, todayRes] = await Promise.all([
        fetch(`${API_URL}/admin/stats`, { headers: authHeaders }),
        fetch(`${API_URL}/admin/today`, { headers: authHeaders })
      ])

      const statsData = await statsRes.json()
      const todayData = await todayRes.json()

      setStats(statsData)
      setRecentActivity((todayData.students || []).slice(0, 10))
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
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

  const statCards = [
    { label: 'Total Students', value: stats?.totalStudents ?? '--', icon: Users, tone: 'indigo' },
    { label: "Today's Visits", value: stats?.todayVisits ?? '--', icon: DoorOpen, tone: 'emerald' },
    { label: 'This Week', value: stats?.thisWeekVisits ?? '--', icon: CalendarDays, tone: 'amber' },
    { label: 'This Month', value: stats?.thisMonthVisits ?? '--', icon: CalendarRange, tone: 'sky' },
    { label: 'All-Time Visits', value: stats?.totalVisits ?? '--', icon: History, tone: 'violet' }
  ]

  const reportItems = [
    { title: 'Daily Signups', path: '/admin/reports/daily', desc: "Today's visitor signups", icon: CalendarCheck },
    { title: 'Weekly Signups', path: '/admin/reports/weekly', desc: 'Visitors over the past week', icon: BarChart3 },
    { title: 'Monthly Signups', path: '/admin/reports/monthly', desc: 'Signups for this month', icon: FileText }
  ]

  if (loading || !stats) {
    return (
      <div className="admin-page-container">
        <div className="admin-loading-card">Loading dashboard...</div>
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
      </div>

      <div className="admin-stats-grid">
        {statCards.map((card) => (
          <div key={card.label} className={`admin-stat-card admin-stat-${card.tone}`}>
            <div className="admin-stat-icon">
              <card.icon size={22} strokeWidth={2} />
            </div>
            <div className="admin-stat-meta">
              <span className="admin-stat-label">{card.label}</span>
              <span className="admin-stat-value">{card.value}</span>
            </div>
          </div>
        ))}
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
                  <p>No check-ins yet today</p>
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
