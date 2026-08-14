import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Download, Printer, Tag, CalendarRange, ArrowLeft } from 'lucide-react'
import { API_URL, getCampusAuthHeaders } from '../../config'
import { useAdminContext } from '../admin/AdminLayout'

export default function ByPurpose() {
  const { activeCampus, refreshKey } = useAdminContext()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedPurpose, setSelectedPurpose] = useState('')

  const fetchReport = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const authHeaders = getCampusAuthHeaders(activeCampus)
      const res = await fetch(`${API_URL}/admin/visits?range=all`, { headers: authHeaders })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error || 'Failed to load report')
      }
      setData(await res.json())
    } catch (err) {
      console.error('Purpose report fetch error:', err)
      setError(err.message || 'Unable to load report')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [activeCampus])

  useEffect(() => {
    fetchReport()
  }, [fetchReport, refreshKey])

  const purposes = useMemo(() => {
    const purposeVisitors = {}
    const purposeCounts = {}
    ;(data?.students || []).forEach((v) => {
      const key = (v.purpose || 'Not specified').trim()
      purposeCounts[key] = (purposeCounts[key] || 0) + 1
      purposeVisitors[key] = new Set([...(purposeVisitors[key] || []), v.phone])
    })
    return Object.entries(purposeCounts)
      .map(([purpose, count]) => ({ purpose, count, unique: purposeVisitors[purpose]?.size || 0 }))
      .sort((a, b) => b.count - a.count)
  }, [data])

  const exportCSV = () => {
    if (!purposes.length) return
    const header = ['Purpose', 'Total Visits', 'Unique Visitors']
    const rows = purposes.map((p) => [
      `"${String(p.purpose).replace(/"/g, '""')}"`,
      p.count,
      p.unique
    ])
    const csv = [header.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `visits-by-purpose-${activeCampus.replace(/\s+/g, '-').toLowerCase()}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const totalVisits = purposes.reduce((sum, p) => sum + p.count, 0)

  return (
    <div className="admin-page-container">
      <div className="admin-page-heading admin-report-heading">
        <div>
          <Link to="/admin/reports" className="admin-back-link">
            <ArrowLeft size={15} strokeWidth={2} />
            Back to Reports
          </Link>
          <h1 className="admin-page-title">Visits by Purpose</h1>
          <p className="admin-page-subtitle">
            Purpose breakdown of all recorded check-ins · <strong>{activeCampus}</strong>
          </p>
        </div>
        <div className="admin-report-actions">
          <span className="admin-report-period">
            <CalendarRange size={15} strokeWidth={2} />
            {data ? `${data.start} → ${data.end}` : 'Loading…'}
          </span>
          <button
            type="button"
            className="admin-btn admin-btn-secondary"
            onClick={exportCSV}
            disabled={!purposes.length}
          >
            <Download size={16} strokeWidth={2} />
            Export CSV
          </button>
          <button type="button" className="admin-btn admin-btn-secondary" onClick={() => window.print()}>
            <Printer size={16} strokeWidth={2} />
            Print
          </button>
        </div>
      </div>

      <div className="report-summary-row">
        <div className="admin-stat-card">
          <div className="admin-stat-label">Total Visits</div>
          <div className="admin-stat-value">{data?.count ?? '--'}</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-label">Purpose Categories</div>
          <div className="admin-stat-value">{purposes.length}</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-label">Most Common</div>
          <div className="admin-stat-value admin-stat-value-sm">{purposes[0]?.purpose || '--'}</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-label">Top Category Share</div>
          <div className="admin-stat-value">
            {totalVisits ? `${Math.round((purposes[0]?.count / totalVisits) * 100)}%` : '--'}
          </div>
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-card-header">
          <div className="admin-card-title">
            <Tag size={18} strokeWidth={2} />
            <h2>Purpose Breakdown</h2>
          </div>
          <span className="admin-card-badge">{purposes.length} purposes</span>
        </div>

        {loading ? (
          <div className="admin-loading">Loading report...</div>
        ) : error ? (
          <div className="admin-empty-state">{error}</div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Purpose</th>
                  <th>Total Visits</th>
                  <th>Unique Visitors</th>
                </tr>
              </thead>
              <tbody>
                {purposes.length ? (
                  purposes.map((p, index) => (
                    <tr
                      key={p.purpose}
                      className={selectedPurpose === p.purpose ? 'admin-row-flagged' : ''}
                      onClick={() => setSelectedPurpose(selectedPurpose === p.purpose ? '' : p.purpose)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td className="admin-table-index">{index + 1}</td>
                      <td><strong>{p.purpose}</strong></td>
                      <td>{p.count}</td>
                      <td>{p.unique}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" className="admin-empty-state">No visits recorded yet.</td>
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
