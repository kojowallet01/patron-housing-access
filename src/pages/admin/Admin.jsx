import { useState, useEffect } from 'react'
import { API_URL, CAMPUS_INSTITUTE_NAME, getCampusAuthHeaders, getSelectedCampus } from '../../config'
import { validateSession } from '../../auth'
import ReportLinks from './ReportLinks'
import RecentActivity from './RecentActivity'
import StatusCard from './StatusCard'
import Analytics from './Analytics'

function Admin() {
  const [activeCampus, setActiveCampus] = useState(getSelectedCampus())
  const [stats, setStats] = useState(null)
  const [todayVisitors, setTodayVisitors] = useState([])
  const [allStudents, setAllStudents] = useState([])
  const [recentActivity, setRecentActivity] = useState([])
  const [view, setView] = useState('today')
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [visitsRange, setVisitsRange] = useState('day')
  const [credentialMap, setCredentialMap] = useState({ admin: {}, security: {}, superAdmin: {} })
  const [draftPasswords, setDraftPasswords] = useState({})
  const [credentialMessage, setCredentialMessage] = useState('')
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [analyticsRange, setAnalyticsRange] = useState('day')
  const [analytics, setAnalytics] = useState(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [addForm, setAddForm] = useState({ name: '', phone: '', purpose: '' })
  const [addMessage, setAddMessage] = useState({ type: '', text: '' })

  useEffect(() => {
    fetchData()
    fetchVisitRange('day')
    fetchAnalytics('day')
  }, [])

  useEffect(() => {
    let active = true

    validateSession().then((session) => {
      if (!active) return
      if (session.valid) {
        setIsSuperAdmin(Boolean(session.isSuperAdmin))
        if (!session.isSuperAdmin) {
          setActiveCampus(session.campus || getSelectedCampus())
        }
      }
      if (session.valid && session.isSuperAdmin) {
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
      fetchAnalytics(analyticsRange)
    }, 5000)
    return () => clearInterval(interval)
  }, [visitsRange, analyticsRange])

  const fetchData = async () => {
    try {
      const authHeaders = getCampusAuthHeaders(activeCampus)
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
      const authHeaders = getCampusAuthHeaders(activeCampus)
      const visitsRes = await fetch(`${API_URL}/admin/visits?range=${range}&campus=${encodeURIComponent(activeCampus)}`, { headers: authHeaders })
      await visitsRes.json()
      setVisitsRange(range)
    } catch (error) {
      console.error('Error fetching visit range:', error)
    }
  }

  const fetchPasswordMap = async () => {
    try {
      const authHeaders = getCampusAuthHeaders(activeCampus)
      const response = await fetch(`${API_URL}/super-admin/passwords`, { headers: authHeaders })
      if (!response.ok) {
        throw new Error('Unable to fetch password map')
      }

      const data = await response.json()
      setCredentialMap({
        admin: data.admin || {},
        security: data.security || {},
        superAdmin: data.superAdmin || {}
      })
    } catch (error) {
      console.error('Error fetching credential map:', error)
    }
  }

  const fetchAnalytics = async (range = 'day') => {
    try {
      const authHeaders = getCampusAuthHeaders(activeCampus)
      const response = await fetch(`${API_URL}/admin/analytics?range=${range}&campus=${encodeURIComponent(activeCampus)}`, { headers: authHeaders })
      if (!response.ok) return
      const data = await response.json()
      setAnalytics(data)
    } catch (error) {
      console.error('Error fetching analytics:', error)
    }
  }

  const handleAnalyticsRange = (range) => {
    setAnalyticsRange(range)
    fetchAnalytics(range)
  }

  const exportCSV = (rows, filename, columns) => {
    const header = columns.map(c => c.label).join(',')
    const body = rows.map(row =>
      columns.map(c => {
        const value = row[c.key] ?? ''
        const escaped = String(value).replace(/"/g, '""')
        return `"${escaped}"`
      }).join(',')
    ).join('\n')

    const blob = new Blob([`${header}\n${body}`], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleAddVisitor = async (e) => {
    e.preventDefault()
    setAddMessage({ type: '', text: '' })

    if (!addForm.name.trim() || !addForm.phone.trim() || !addForm.purpose.trim()) {
      setAddMessage({ type: 'error', text: 'Name, phone and purpose are required.' })
      return
    }

    try {
      const authHeaders = getCampusAuthHeaders(activeCampus)
      const response = await fetch(`${API_URL}/admin/students`, {
        method: 'POST',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ...addForm, campus: activeCampus })
      })

      const data = await response.json()
      if (!response.ok) {
        setAddMessage({ type: 'error', text: data.error || 'Failed to add visitor.' })
        return
      }

      setAddMessage({ type: 'success', text: `${addForm.name} added to ${activeCampus}.` })
      setAddForm({ name: '', phone: '', purpose: '' })
      setShowAddForm(false)
      fetchData()
    } catch (error) {
      console.error('Error adding visitor:', error)
      setAddMessage({ type: 'error', text: 'Unable to add visitor right now.' })
    }
  }

  const handleFlag = async (student, flagged, note) => {
    try {
      const authHeaders = getCampusAuthHeaders(activeCampus)
      const response = await fetch(`${API_URL}/admin/students/${student.id}/flag`, {
        method: 'POST',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ flagged, note })
      })

      if (!response.ok) throw new Error('Flag update failed')
      fetchData()
    } catch (error) {
      console.error('Error updating flag:', error)
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
      const authHeaders = getCampusAuthHeaders(activeCampus)
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
            <p>{CAMPUS_INSTITUTE_NAME} • {activeCampus}</p>
          </div>
        </div>
        <div className="header-actions">
          {isSuperAdmin && (
            <button className="btn btn-secondary" onClick={() => window.location.href = '/campus-selector'}>
              Switch Campus
            </button>
          )}
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
                <div className="stat-label">Total Students</div>
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
                  {['TESANO CAMPUS', 'CANTOMENT CAMPUS', 'ASHIAMAN CAMPUS', 'LEGON CAMPUS', 'TEMA CAMPUS'].map((campusName) => (
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
                        <div>
                          <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>Super admin password</label>
                          <input
                            type="password"
                            value={draftPasswords[`${campusName}:super-admin`] ?? credentialMap.superAdmin?.[campusName] ?? ''}
                            onChange={(e) => handlePasswordChange(campusName, 'super-admin', e.target.value)}
                            placeholder="Set super admin password"
                            style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #cbd5e1' }}
                          />
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <button className="btn btn-primary" onClick={() => saveCampusPassword(campusName, 'admin')} style={{ width: 'auto', padding: '10px 16px' }}>Save Admin</button>
                          <button className="btn btn-secondary" onClick={() => saveCampusPassword(campusName, 'security')} style={{ width: 'auto', padding: '10px 16px' }}>Save Security</button>
                          <button className="btn btn-secondary" onClick={() => saveCampusPassword(campusName, 'super-admin')} style={{ width: 'auto', padding: '10px 16px' }}>Save Super Admin</button>
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

            <Analytics analytics={analytics} range={analyticsRange} onRangeChange={handleAnalyticsRange} />

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
                  All Students ({allStudents.length})
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

              <div className="table-actions">
                {view === 'today' && (
                  <button
                    className="btn btn-secondary btn-small"
                    onClick={() => exportCSV(todayVisitors, `visitors-${new Date().toISOString().split('T')[0]}.csv`, [
                      { key: 'name', label: 'Name' },
                      { key: 'phone', label: 'Phone' },
                      { key: 'purpose', label: 'Purpose' },
                      { key: 'campus', label: 'Campus' },
                      { key: 'used_at', label: 'Entry Time' }
                    ])}
                  >
                    ⬇ Export CSV
                  </button>
                )}
                {view === 'all' && (
                  <button
                    className="btn btn-secondary btn-small"
                    onClick={() => exportCSV(allStudents, `students-${activeCampus.replace(/\s+/g, '-').toLowerCase()}.csv`, [
                      { key: 'name', label: 'Name' },
                      { key: 'phone', label: 'Phone' },
                      { key: 'purpose', label: 'Purpose' },
                      { key: 'campus', label: 'Campus' },
                      { key: 'created_at', label: 'Registered' }
                    ])}
                  >
                    ⬇ Export CSV
                  </button>
                )}
                <button className="btn btn-primary btn-small" onClick={() => setShowAddForm(true)}>
                  ➕ Add Visitor
                </button>
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
                <h3>All Registered Students</h3>
                {filteredStudents.length === 0 ? (
                  <div className="no-data">
                    {searchTerm ? 'No matching students found' : 'No students registered'}
                  </div>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Phone</th>
                        <th>Purpose</th>
                        <th>Registered</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStudents.map((student) => (
                        <tr key={student.id} className={student.flagged ? 'row-flagged' : ''}>
                          <td>
                            <strong>{student.name}</strong>
                            {student.flagged && <span className="flag-badge">⚠️ Flagged</span>}
                          </td>
                          <td>{student.phone || '-'}</td>
                          <td>{student.purpose || '-'}</td>
                          <td>{new Date(student.created_at).toLocaleString()}</td>
                          <td>
                            {student.flagged ? (
                              <button className="btn btn-small btn-warning" onClick={() => handleFlag(student, false, '')}>
                                Clear Flag
                              </button>
                            ) : (
                              <button
                                className="btn btn-small btn-secondary"
                                onClick={() => {
                                  const note = window.prompt(`Flag ${student.name} — reason:`) || ''
                                  handleFlag(student, true, note)
                                }}
                              >
                                Flag
                              </button>
                            )}
                          </td>
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

      {showAddForm && (
        <div className="modal-overlay" onClick={() => setShowAddForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Add Visitor to {activeCampus}</h3>
            <p className="modal-subtitle">Add a student or visitor without the QR registration flow.</p>

            <form onSubmit={handleAddVisitor}>
              <div className="form-group">
                <label>Full Name</label>
                <input
                  type="text"
                  value={addForm.name}
                  onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                  placeholder="e.g. Kwame Mensah"
                  required
                />
              </div>
              <div className="form-group">
                <label>Phone</label>
                <input
                  type="text"
                  value={addForm.phone}
                  onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
                  placeholder="e.g. 0244123456"
                  required
                />
              </div>
              <div className="form-group">
                <label>Purpose</label>
                <input
                  type="text"
                  value={addForm.purpose}
                  onChange={(e) => setAddForm({ ...addForm, purpose: e.target.value })}
                  placeholder="e.g. Student, Visitor, Staff"
                  required
                />
              </div>

              {addMessage.text && (
                <div className={`alert ${addMessage.type === 'error' ? 'alert-error' : 'alert-success'}`}>
                  {addMessage.text}
                </div>
              )}

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddForm(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Add Visitor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Admin
