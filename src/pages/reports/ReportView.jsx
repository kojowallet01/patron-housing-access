import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Download, Printer, CalendarRange, Search, ArrowLeft } from 'lucide-react'
import { API_URL, getCampusAuthHeaders } from '../../config'
import { useAdminContext } from '../admin/AdminLayout'

export default function ReportView({ range, title, subtitle }) {
  const { activeCampus, refreshKey } = useAdminContext()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [purpose, setPurpose] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    setPurpose('')
  }, [range, activeCampus])

  useEffect(() => {
    fetchReport()
  }, [range, activeCampus, refreshKey, purpose])

  const fetchReport = async () => {
    try {
      setLoading(true)
      setError(null)
      const authHeaders = getCampusAuthHeaders(activeCampus)
      const purposeQuery = purpose ? `&purpose=${encodeURIComponent(purpose)}` : ''
      const res = await fetch(`${API_URL}/admin/visits?range=${range}${purposeQuery}`, { headers: authHeaders })
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

  const filteredStudents = useMemo(() => {
    const rows = data?.students || []
    const term = searchTerm.trim().toLowerCase()
    if (!term) return rows
    return rows.filter(s =>
      (s.name || '').toLowerCase().includes(term) ||
      (s.phone || '').toLowerCase().includes(term) ||
      (s.purpose || '').toLowerCase().includes(term)
    )
  }, [data, searchTerm])

  return (
    <div className="admin-page-container">
      <div className="admin-page-heading admin-report-heading">
        <div>
          <Link to="/admin/reports" className="admin-back-link">
            <ArrowLeft size={15} strokeWidth={2} />
            Back to Reports
          </Link>
          <h1 className="admin-page-title">{title}</h1>
          <p className="admin-page-subtitle">
            {subtitle} · <strong>{activeCampus}</strong>
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
            disabled={!data?.students?.length}
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
          <div className="admin-stat-label">Unique Visitors</div>
          <div className="admin-stat-value">{data ? uniqueVisitors : '--'}</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-label">Period Start</div>
          <div className="admin-stat-value admin-stat-value-sm">{data?.start || '--'}</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-label">Period End</div>
          <div className="admin-stat-value admin-stat-value-sm">{data?.end || '--'}</div>
        </div>
      </div>

      {(data?.purposes?.length || 0) > 0 && (
        <div className="admin-card admin-filters-card">
          <div className="admin-purpose-filter">
            <span className="admin-purpose-filter-label">Filter by purpose:</span>
            <button
              type="button"
              className={`admin-purpose-chip${!purpose ? ' active' : ''}`}
              onClick={() => setPurpose('')}
            >
              All
              <span className="admin-purpose-chip-count">
                {data.purposes.reduce((sum, p) => sum + (p.count || 0), 0)}
              </span>
            </button>
            {data.purposes.map(p => (
              <button
                key={p.purpose}
                type="button"
                className={`admin-purpose-chip${purpose === p.purpose ? ' active' : ''}`}
                onClick={() => setPurpose(p.purpose)}
              >
                {p.purpose}
                <span className="admin-purpose-chip-count">{p.count}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="admin-card">
        <div className="admin-card-header">
          <div className="admin-card-title">
            <h2>Visitor List</h2>
          </div>
          <span className="admin-card-badge">
            {filteredStudents.length}{filteredStudents.length !== (data?.students?.length || 0) ? ` of ${data?.students?.length || 0}` : ''} entries
          </span>
        </div>

        <div className="admin-table-toolbar">
          <div className="admin-search">
            <Search size={16} strokeWidth={2} />
            <input
              type="text"
              placeholder="Search by name, phone, or purpose..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <span className="admin-row-count">{uniqueVisitors} unique visitors</span>
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
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Purpose</th>
                  <th>Campus</th>
                  <th>Check-in Time</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.length ? (
                  filteredStudents.map((student, index) => (
                    <tr key={index}>
                      <td className="admin-table-index">{index + 1}</td>
                      <td><strong>{student.name}</strong></td>
                      <td>{student.phone || '-'}</td>
                      <td>{student.purpose || '-'}</td>
                      <td>{student.campus || activeCampus}</td>
                      <td>{new Date(student.used_at).toLocaleString()}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="admin-empty-state">
                      {searchTerm.trim() ? 'No visitors match your search.' : 'No signups recorded for this range.'}
                    </td>
                  </tr>
                )}
              </tbody>
              {filteredStudents.length > 0 && (
                <tfoot>
                  <tr className="admin-table-footer">
                    <td colSpan="3">Total ({filteredStudents.length} visits)</td>
                    <td colSpan="3">{uniqueVisitors} unique visitors</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
