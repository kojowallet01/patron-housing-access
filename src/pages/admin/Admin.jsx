import React, { useState, useEffect } from 'react'
import { API_URL, CAMPUS_INSTITUTE_NAME, getCampusAuthHeaders, getSelectedCampus } from '../../config'
import { validateSession } from '../../auth'
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
  const [credentialMap, setCredentialMap] = useState({ admin: {}, security: {} })
  const [draftPasswords, setDraftPasswords] = useState({})
  const [credentialMessage, setCredentialMessage] = useState('')
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)

  useEffect(() => {
    fetchData()
    fetchVisitRange('day')
  }, [])

  useEffect(() => {
    let active = true

    validateSession().then((session) => {
      if (!active) return
      if (session.valid && session.isSuperAdmin) {
        setIsSuperAdmin(true)
        fetchPasswordMap()
      }
    })

    return () => {
      active = false
    }
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

  const fetchPasswordMap = async () => {
    try {
      const authHeaders = getCampusAuthHeaders('admin')
      const response = await fetch(`${API_URL}/super-admin/passwords`, { headers: authHeaders })
      if (!response.ok) {
        throw new Error('Unable to fetch password map')
      }

      const data = await response.json()
      setCredentialMap({
        admin: data.admin || {},
        security: data.security || {}
      })
    } catch (error) {
      console.error('Error fetching credential map:', error)
    }
  }

  const handlePasswordChange = (campusName, role, value) => {
    setDraftPasswords(prev => ({
      ...prev,
      [`${campusName}:${role}`]: value
    }))
  }

  const saveCampusPassword = async (campusName, role) => {
    const value = (draftPasswords[`${campusName}:${role}`] ?? credentialMap[role]?.[campusName] ?? '').trim()

    if (!value) {
      setCredentialMessage('Password cannot be empty.')
      return
    }

    try {
      const authHeaders = getCampusAuthHeaders('admin')
      const response = await fetch(`${API_URL}/super-admin/passwords`, {
        method: 'POST',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ campus: campusName, role, password: value })
      })

      if (!response.ok) {
        throw new Error('Failed to save password')
      }

      setCredentialMessage(`${role.toUpperCase()} password saved for ${campusName}.`)
      await fetchPasswordMap()
    } catch (error) {
      console.error('Error saving campus password:', error)
      setCredentialMessage('Unable to save the password at the moment.')
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

            {isSuperAdmin && (
              <div className="credential-manager" style={{ marginBottom: 24 }}>
                <h3>Campus Password Manager</h3>
                <div className="credential-grid" style={{ display: 'grid', gap: 12 }}>
                  {['TESANO CAMPUS', 'CHRISTIANSBORG CAMPUS', 'ASHIAMAN CAMPUS', 'LEGON CAMPUS'].map((campusName) => (
                    <div key={campusName} className="credential-card" style={{ border: '1px solid #dfe6f1', borderRadius: 14, padding: 16, background: '#f8fafc' }}>
                      <div style={{ fontWeight: 700, marginBottom: 12 }}>{campusName}</div>
                      <div style={{ display: 'grid', gap: 10 }}>
                        <div>
                          <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>Admin password</label>
                          <input
                            type="password"
                            value={draftPasswords[`${campusName}:admin`] ?? credentialMap.admin?.[campusName] ?? ''}
                            onChange={(e) => handlePasswordChange(campusName, 'admin', e.target.value)}
                            placeholder="Set admin password"
                            style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #cbd5e1' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>Security password</label>
                          <input
                            type="password"
                            value={draftPasswords[`${campusName}:security`] ?? credentialMap.security?.[campusName] ?? ''}
                            onChange={(e) => handlePasswordChange(campusName, 'security', e.target.value)}
                            placeholder="Set security password"
                            style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #cbd5e1' }}
                          />
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <button className="btn btn-primary" onClick={() => saveCampusPassword(campusName, 'admin')} style={{ width: 'auto', padding: '10px 16px' }}>Save Admin</button>
                          <button className="btn btn-secondary" onClick={() => saveCampusPassword(campusName, 'security')} style={{ width: 'auto', padding: '10px 16px' }}>Save Security</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {credentialMessage && (
                  <div className="alert alert-success" style={{ marginTop: 12 }}>{credentialMessage}</div>
                )}
              </div>
            )}

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
