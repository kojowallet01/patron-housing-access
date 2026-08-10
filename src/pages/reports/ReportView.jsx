import React, { useState, useEffect } from 'react'
import { API_URL, ADMIN_TOKEN } from '../../config'

export default function ReportView({ range, title, subtitle }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchReport()
  }, [range])

  const fetchReport = async () => {
    try {
      setLoading(true)
      setError(null)
      const authHeaders = ADMIN_TOKEN ? { 'x-admin-token': ADMIN_TOKEN } : {}
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

  return (
    <div className="fullscreen-container admin-page report-page">
      <div className="admin-header report-header-row">
        <div>
          <h1>{title}</h1>
          <p className="report-subtitle">{subtitle}</p>
        </div>
        <div className="header-actions">
          <a className="btn btn-refresh" href="/admin">
            ← Dashboard
          </a>
        </div>
      </div>

      <div className="admin-content report-content">
        <div className="report-summary-row">
          <div className="summary-card">
            <span className="summary-label">Visitors</span>
            <strong>{data?.count ?? '--'}</strong>
          </div>
          <div className="summary-card">
            <span className="summary-label">Start</span>
            <strong>{data?.start || '--'}</strong>
          </div>
          <div className="summary-card">
            <span className="summary-label">End</span>
            <strong>{data?.end || '--'}</strong>
          </div>
        </div>

        {loading ? (
          <div className="loading report-loading">Loading report...</div>
        ) : error ? (
          <div className="no-data report-no-data">{error}</div>
        ) : (
          <div className="report-table-card">
            <table className="report-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Purpose</th>
                  <th>Check-in</th>
                </tr>
              </thead>
              <tbody>
                {data?.students?.length ? (
                  data.students.map((student, index) => (
                    <tr key={index}>
                      <td>{student.name}</td>
                      <td>{student.phone || '-'}</td>
                      <td>{student.purpose || '-'}</td>
                      <td>{new Date(student.used_at).toLocaleString()}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" className="no-data report-no-data">No signups recorded for this range.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
