import React, { useState, useEffect } from 'react'

function AdminDashboard() {
  const [stats, setStats] = useState(null)
  const [todayVisitors, setTodayVisitors] = useState([])
  const [allStudents, setAllStudents] = useState([])
  const [view, setView] = useState('today')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
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
    } catch (error) {
      console.error('Error fetching admin data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="card loading">Loading dashboard...</div>
  }

  return (
    <div>
      <div className="card">
        <h2>📊 Admin Dashboard</h2>
        
        <div className="stats-grid">
          <div className="stat-card">
            <h3>{stats.totalStudents}</h3>
            <p>Total Students</p>
          </div>
          <div className="stat-card">
            <h3>{stats.todayVisits}</h3>
            <p>Today's Visits</p>
          </div>
          <div className="stat-card">
            <h3>{stats.totalVisits}</h3>
            <p>Total Visits</p>
          </div>
        </div>

        <div style={{ marginTop: '30px' }}>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
            <button
              className={`btn ${view === 'today' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setView('today')}
            >
              Today's Visitors
            </button>
            <button
              className={`btn ${view === 'all' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setView('all')}
            >
              All Students
            </button>
          </div>

          {view === 'today' && (
            <div className="table-container">
              <h3>Students on Campus Today</h3>
              {todayVisitors.length === 0 ? (
                <p style={{ color: '#666', padding: '20px' }}>No visitors today yet.</p>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Home Campus</th>
                      <th>Entry Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {todayVisitors.map((visitor, index) => (
                      <tr key={index}>
                        <td>{visitor.name}</td>
                        <td>{visitor.email}</td>
                        <td>{visitor.home_campus || '-'}</td>
                        <td>{new Date(visitor.used_at).toLocaleTimeString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {view === 'all' && (
            <div className="table-container">
              <h3>All Registered Students</h3>
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Home Campus</th>
                    <th>Registered</th>
                  </tr>
                </thead>
                <tbody>
                  {allStudents.map((student) => (
                    <tr key={student.id}>
                      <td>{student.name}</td>
                      <td>{student.email}</td>
                      <td>{student.phone || '-'}</td>
                      <td>{student.home_campus || '-'}</td>
                      <td>{new Date(student.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default AdminDashboard
