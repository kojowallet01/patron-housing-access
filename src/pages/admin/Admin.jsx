import React, { useState, useEffect } from 'react'
import { API_URL, CAMPUS_INSTITUTE_NAME, getCampusAuthHeaders, getSelectedCampus } from '../../config'
import ReportLinks from './ReportLinks'
import RecentActivity from './RecentActivity'
import StatusCard from './StatusCard'

function Admin() {
  const campus = getSelectedCampus()
  const [stats, setStats] = useState(null)
  const [todayVisitors, setTodayVisitors] = useState([])
  const [allStudents, setAllStudents] = useState([])
  const [recentActivity, setRecentActivity] = useState([])
  const [view, setView] = useState('today')
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [visitsRange, setVisitsRange] = useState('day')
  const [rangeVisitors, setRangeVisitors] = useState([])
  const [rangeInfo, setRangeInfo] = useState(null)
  const [rangeLoading, setRangeLoading] = useState(false)

  useEffect(() => {
    fetchData()
    fetchVisitRange('day')
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      fetchData()
      fetchVisitRange(visitsRange)
    }, 5000)
    return () => clearInterval(interval)
  }, [visitsRange])

  const fetchData = async () => {
    try {
      const authHeaders = getCampusAuthHeaders('admin')
      const [statsRes, todayRes, studentsRes] = await Promise.all([
        fetch(`${API_URL}/admin/stats`, { headers: authHeaders }),
        fetch(`${API_URL}/admin/today`, { headers: authHeaders }),
        fetch(`${API_URL}/admin/students`, { headers: authHeaders })
      ])

      const statsData = await statsRes.json()
      const todayData = await todayRes.json()
      const studentsData = await studentsRes.json()

      setStats(statsData)
      setTodayVisitors(todayData.students)
      setAllStudents(studentsData.students)
      
      // Create recent activity feed (last 10 visitors)
      const recent = todayData.students.slice(0, 10).map(v => ({
        ...v,
        type: 'check-in',
        timestamp: v.used_at
      }))
      setRecentActivity(recent)
    } catch (error) {
      console.error('Error fetching admin data:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchVisitRange = async (range = 'day') => {
    try {
      setRangeLoading(true)
      const authHeaders = getCampusAuthHeaders('admin')
      const visitsRes = await fetch(`${API_URL}/admin/visits?range=${range}&campus=${encodeURIComponent(campus)}`, { headers: authHeaders })
      const visitsData = await visitsRes.json()
      setRangeVisitors(visitsData.students || [])
      setRangeInfo(visitsData)
      setVisitsRange(range)
    } catch (error) {
      console.error('Error fetching visit range:', error)
    } finally {
      setRangeLoading(false)
    }
  }

  const filteredVisitors = todayVisitors.filter(v => 
    v.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (v.phone || '').toLowerCase().includes(searchTerm.toLowerCase())
  )

  const filteredStudents = allStudents.filter(s =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.phone || '').toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading || !stats) {
    return (
      <div className="fullscreen-container">
        <div className="loading">Loading dashboard...</div>
      </div>
    )
  }

  return (
    <div className="fullscreen-container admin-page">
      <div className="admin-header">
        <div className="admin-header-left">
          <img src="/logo.png" alt="Patron Housing" className="admin-logo" />
          <div>
            <h1>Admin Dashboard</h1>
            <p>{CAMPUS_INSTITUTE_NAME} • {campus}</p>
          </div>
        </div>
        <div className="header-actions">
          <button className="btn btn-secondary" onClick={() => window.location.href = '/campus-selector'}>
            Switch Campus
          </button>
          <div className="live-indicator">
            <span className="pulse-dot"></span>
            <span>Live</span>
          </div>
          <button className="btn btn-refresh" onClick={fetchData}>
            🔄 Refresh
          </button>
        </div>
      </div>

      <div className="admin-content">
        <div className="admin-layout">
          <div className="main-section">
            <div className="stats-grid">
              <div className="stat-card stat-primary">
                <div className="stat-value">{stats.totalStudents}</div>
                <div className="stat-label">Total Residents</div>
              </div>
              <div className="stat-card stat-success">
                <div className="stat-value">{stats.todayVisits}</div>
                <div className="stat-label">Today's Visits</div>
              </div>
              <div className="stat-card stat-warning">
                <div className="stat-value">{stats.thisWeekVisits}</div>
                <div className="stat-label">This Week</div>
              </div>
              <div className="stat-card stat-info">
                <div className="stat-value">{stats.thisMonthVisits}</div>
                <div className="stat-label">This Month</div>
              </div>
              <div className="stat-card stat-secondary">
                <div className="stat-value">{stats.totalVisits}</div>
                <div className="stat-label">All-Time Visits</div>
              </div>
            </div>

            <div className="admin-controls">
              <div className="view-tabs">
                <button
                  className={`tab ${view === 'today' ? 'active' : ''}`}
                  onClick={() => setView('today')}
                >
                  Today's Visitors ({todayVisitors.length})
                </button>
                <button
                  className={`tab ${view === 'all' ? 'active' : ''}`}
                  onClick={() => setView('all')}
                >
                  All Residents ({allStudents.length})
                </button>
              </div>

              <div className="search-box">
                <input
                  type="text"
                  placeholder="🔍 Search by name or phone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="search-input"
                />
              </div>
            </div>

            {view === 'today' && (
              <div className="data-table">
                <h3>Visitors in Building Today</h3>
                {filteredVisitors.length === 0 ? (
                  <div className="no-data">
                    {searchTerm ? 'No matching visitors found' : 'No visitors yet today'}
                  </div>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Phone</th>
                        <th>Purpose</th>
                        <th>Entry Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredVisitors.map((visitor, index) => (
                        <tr key={index}>
                          <td><strong>{visitor.name}</strong></td>
                          <td>{visitor.phone || '-'}</td>
                          <td>{visitor.purpose || '-'}</td>
                          <td>{new Date(visitor.used_at).toLocaleTimeString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {view === 'all' && (
              <div className="data-table">
                <h3>All Registered Residents</h3>
                {filteredStudents.length === 0 ? (
                  <div className="no-data">
                    {searchTerm ? 'No matching residents found' : 'No residents registered'}
                  </div>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Phone</th>
                        <th>Purpose</th>
                        <th>Registered</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStudents.map((student) => (
                        <tr key={student.id}>
                          <td><strong>{student.name}</strong></td>
                          <td>{student.phone || '-'}</td>
                          <td>{student.purpose || '-'}</td>
                          <td>{new Date(student.created_at).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>

          <div className="sidebar-section">
            <ReportLinks />
            <RecentActivity activities={recentActivity} />
            <StatusCard />
          </div>
        </div>
      </div>
    </div>
  )
}

export default Admin
