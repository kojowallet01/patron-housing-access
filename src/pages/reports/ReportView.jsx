import React, { useState, useEffect } from 'react'
import { API_URL, getCampusAuthHeaders, getSelectedCampus } from '../../config'

export default function ReportView({ range, title, subtitle }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const campus = getSelectedCampus()

  useEffect(() => {
    fetchReport()
  }, [range])

  const fetchReport = async () => {
    try {
      setLoading(true)
      setError(null)
      const authHeaders = getCampusAuthHeaders('admin')
      const res = await fetch(`${API_URL}/admin/visits?range=${range}`, { headers: authHeaders })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error || 'Failed to load report')
      }
      const json = await res.json()
      setData(json)
    } catch (err) {
      console.error('Report fetch error:', err)
      setError(err.message || 'Unable to load report')
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  const exportCSV = () => {
    if (!data?.students?.length) return
    const header = ['Name', 'Phone', 'Purpose', 'Campus', 'Check-in Time']
    const rows = data.students.map(s => [
      `"${String(s.name || '').replace(/"/g, '""')}"`,
      `"${String(s.phone || '').replace(/"/g, '""')}"`,
      `"${String(s.purpose || '').replace(/"/g, '""')}"`,
      `"${String(s.campus || '').replace(/"/g, '""')}"`,
      `"${new Date(s.used_at).toLocaleString()}"`
    ])
    const csv = [header.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${title.toLowerCase().replace(/\s+/g, '-')}-${data.start}-to-${data.end}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const uniqueVisitors = data?.students ? new Set(data.students.map(s => s.phone)).size : 0

  return (
    <div className="fullscreen-container admin-page report-page">
      <div className="admin-header report-header-row">
        <div className="report-title-block">
          <img src="/logo.png" alt="Patron Housing" className="report-logo" />
          <div>
            <h1>{title}</h1>
            <p className="report-subtitle">{subtitle}</p>
          </div>
        </div>
        <div className="header-actions report-actions">
          <span className="report-period-badge">
            {data ? `${data.start} → ${data.end}` : 'Loading…'}
          </span>
          <button className="btn btn-secondary btn-small" onClick={exportCSV} disabled={!data?.students?.length}>
            ⬇ Export CSV
          </button>
          <button className="btn btn-secondary btn-small" onClick={() => window.print()}>
            🖨 Print
          </button>
          <a className="btn btn-refresh" href="/admin">
            ← Dashboard
          </a>
        </div>
      </div>

      <div className="admin-content report-content">
        <div className="report-campus-line">
          Campus: <strong>{campus}</strong>
        </div>

        <div className="report-summary-row">
          <div className="summary-card summary-primary">
            <span className="summary-label">Total Visits</span>
            <strong>{data?.count ?? '--'}</strong>
          </div>
          <div className="summary-card">
            <span className="summary-label">Unique Visitors</span>
            <strong>{data ? uniqueVisitors : '--'}</strong>
          </div>
          <div className="summary-card">
            <span className="summary-label">Period Start</span>
            <strong>{data?.start || '--'}</strong>
          </div>
          <div className="summary-card">
            <span className="summary-label">Period End</span>
            <strong>{data?.end || '--'}</strong>
          </div>
        </div>

        {loading ? (
          <div className="loading report-loading">Loading report...</div>
        ) : error ? (
          <div className="no-data report-no-data">{error}</div>
        ) : (
          <div className="report-table-card">
            <div className="report-table-header">
              <h2>{title} — Visitor List</h2>
              <span className="report-row-count">{data?.students?.length || 0} entries</span>
            </div>
            <div className="report-table-scroll">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Name</th>
                    <th>Phone</th>
                    <th>Purpose</th>
                    <th>Campus</th>
                    <th>Check-in Time</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.students?.length ? (
                    data.students.map((student, index) => (
                      <tr key={index}>
                        <td className="report-index">{index + 1}</td>
                        <td><strong>{student.name}</strong></td>
                        <td>{student.phone || '-'}</td>
                        <td>{student.purpose || '-'}</td>
                        <td>{student.campus || campus}</td>
                        <td>{new Date(student.used_at).toLocaleString()}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="6" className="no-data report-no-data">No signups recorded for this range.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
