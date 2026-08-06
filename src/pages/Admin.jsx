import React, { useState, useEffect } from 'react'

function Admin() {
  const [stats, setStats] = useState(null)
  const [todayVisitors, setTodayVisitors] = useState([])
  const [allStudents, setAllStudents] = useState([])
  const [recentActivity, setRecentActivity] = useState([])
  const [view, setView] = useState('today')
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    fetchData()
    // Refresh data every 5 seconds for real-time updates
    const interval = setInterval(fetchData, 5000)
    return () => clearInterval(interval)
  }, [])

  const fetchData = async () => {
    try {
      const [statsRes, todayRes, studentsRes] = await Promise.all([
        fetch('http://localhost:3001/api/admin/stats'),
        fetch('http://localhost:3001/api/admin/today'),
        fetch('http://localhost:3001/api/admin/students')
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

  const filteredVisitors = todayVisitors.filter(v => 
    v.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const filteredStudents = allStudents.filter(s =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
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
            <p>Patron Housing</p>
          </div>
        </div>
        <div className="header-actions">
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
              <div className="stat-card stat-info">
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
                  placeholder="🔍 Search by name or email..."
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
            <div className="activity-panel">
              <div className="activity-header">
                <h3>🔔 Recent Activity</h3>
                <span className="activity-badge">{recentActivity.length}</span>
              </div>
              
              <div className="activity-feed">
                {recentActivity.length === 0 ? (
                  <div className="no-activity">
                    <p>No activity yet today</p>
                    <p className="small-text">Check-ins will appear here in real-time</p>
                  </div>
                ) : (
                  recentActivity.map((activity, index) => (
                    <div key={index} className="activity-item">
                      <div className="activity-icon">✓</div>
                      <div className="activity-details">
                        <div className="activity-name">{activity.name}</div>
                        <div className="activity-time">
                          {new Date(activity.timestamp).toLocaleTimeString()}
                        </div>
                        <div className="activity-action">Checked In</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="qr-status-panel">
              <h3>📱 Entry Status</h3>
              <div className="status-item">
                <span className="status-label">Entrance QR:</span>
                <span className="status-value active">● Active</span>
              </div>
              <div className="status-item">
                <span className="status-label">Security Check:</span>
                <span className="status-value active">● Online</span>
              </div>
              <div className="status-item">
                <span className="status-label">Last Refresh:</span>
                <span className="status-value">{new Date().toLocaleTimeString()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Admin
