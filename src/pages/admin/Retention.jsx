import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Users,
  Repeat,
  UserPlus,
  AlertTriangle,
  UserX,
  TrendingUp,
  Search,
  MessageSquare,
  Send
} from 'lucide-react'
import { API_URL, getCampusAuthHeaders } from '../../config'
import { useAdminContext } from './AdminLayout'

const STATUS_META = {
  returning: { label: 'Returning', color: '#10b981' },
  new: { label: 'New', color: '#3b82f6' },
  at_risk: { label: 'At Risk', color: '#f59e0b' },
  churned: { label: 'Churned', color: '#ef4444' },
  inactive: { label: 'Inactive', color: '#94a3b8' }
}

function statusInfo(status) {
  return STATUS_META[status] || { label: status, color: '#94a3b8' }
}

function formatDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function Retention() {
  const { activeCampus, refreshKey } = useAdminContext()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [sms, setSms] = useState({ status: null, sending: false, result: null })

  const fetchData = useCallback(async () => {
    try {
      const headers = getCampusAuthHeaders(activeCampus)
      const res = await fetch(`${API_URL}/admin/retention`, { headers })
      if (!res.ok) throw new Error('Retention request failed')
      setData(await res.json())
      setError('')
    } catch (err) {
      console.error('Error fetching retention:', err)
      setError('Unable to load retention data. The connection or session may have expired.')
    } finally {
      setLoading(false)
    }
  }, [activeCampus])

  useEffect(() => {
    fetchData()
  }, [fetchData, refreshKey])

  const textableStatuses = ['at_risk', 'churned', 'inactive']

  const sendEngagementSms = useCallback(async () => {
    if (!data) return
    const recipients = (data.records || [])
      .filter((r) => textableStatuses.includes(r.status) && r.phone)
      .map((r) => ({ phone: r.phone, name: r.name }))
    if (recipients.length === 0) {
      setSms({ status: 'error', sending: false, result: 'No at-risk, churned, or inactive members have a phone number to text.' })
      return
    }
    setSms((prev) => ({ ...prev, sending: true, result: null, status: null }))
    try {
      const headers = getCampusAuthHeaders(activeCampus)
      const message = `Hello {name}, we've missed you at ${activeCampus}. We'd love to see you again soon. Warm regards, the team.`
      const res = await fetch(`${API_URL}/sms/send`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipients,
          message,
          from: undefined
        })
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setSms({ status: 'error', sending: false, result: body.error || 'Failed to send SMS.' })
        return
      }
      const s = body.sms || {}
      const note = s.sent !== undefined
        ? `Sent ${s.sent} message(s). ${s.failed ? s.failed + ' failed.' : ''} ${s.skipped ? s.skipped + ' skipped (no provider).' : ''}`
        : 'Messages sent.'
      setSms({ status: 'success', sending: false, result: note })
    } catch (err) {
      console.error('SMS send error:', err)
      setSms({ status: 'error', sending: false, result: 'Unable to reach the SMS service.' })
    }
  }, [data, activeCampus])

  const textableCount = useMemo(() => {
    if (!data) return 0
    return (data.records || []).filter((r) => textableStatuses.includes(r.status) && r.phone).length
  }, [data])

  const rows = useMemo(() => {
    if (!data) return []
    let list = data.records || []
    if (statusFilter !== 'all') list = list.filter((r) => r.status === statusFilter)
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase()
      list = list.filter(
        (r) =>
          (r.name || '').toLowerCase().includes(term) ||
          (r.phone || '').toLowerCase().includes(term)
      )
    }
    return list
  }, [data, statusFilter, searchTerm])

  if (loading && !data) {
    return <div className="admin-page-container"><div className="admin-loading-card">Loading retention data...</div></div>
  }

  if (!data) {
    return (
      <div className="admin-page-container">
        <div className="admin-loading-card">
          <p>{error || 'Unable to load retention data.'}</p>
          <button type="button" className="admin-btn admin-btn-primary" onClick={fetchData} style={{ marginTop: '12px' }}>Retry</button>
        </div>
      </div>
    )
  }

  const s = data.summary || {}

  const tiles = [
    { label: 'Total Registered', value: s.total ?? '--', icon: Users, tone: 'indigo' },
    { label: 'Returning', value: s.returning ?? '--', icon: Repeat, tone: 'emerald' },
    { label: 'New', value: s.new ?? '--', icon: UserPlus, tone: 'sky' },
    { label: 'At Risk', value: s.atRisk ?? '--', icon: AlertTriangle, tone: 'amber' },
    { label: 'Churned', value: s.churned ?? '--', icon: UserX, tone: 'rose' },
    { label: 'Returning Rate', value: `${s.returningRate ?? 0}%`, icon: TrendingUp, tone: 'violet' }
  ]

  const statusOptions = ['all', ...Object.keys(STATUS_META)]

  return (
    <div className="admin-page-container">
      <div className="admin-page-heading">
        <div>
          <h1 className="admin-page-title">Retention & Churn</h1>
          <p className="admin-page-subtitle">Who&apos;s returning, who&apos;s gone quiet, and who&apos;s stopped coming</p>
        </div>
        <div className="admin-heading-actions">
          <button
            type="button"
            className="admin-btn admin-btn-primary"
            onClick={sendEngagementSms}
            disabled={sms.sending || textableCount === 0}
            title={textableCount === 0 ? 'No at-risk, churned, or inactive members with a phone number' : `Text ${textableCount} at-risk + churned + inactive members`}
          >
            {sms.sending ? <Send size={16} strokeWidth={2} className="admin-spin" /> : <MessageSquare size={16} strokeWidth={2} />}
            Follow-up SMS ({textableCount})
          </button>
        </div>
      </div>

      {sms.result && (
        <div className={`admin-alert admin-alert-${sms.status}`}>
          {sms.result}
        </div>
      )}

      <div className="admin-stats-grid admin-stats-grid-4">
        {tiles.map((tile) => (
          <div key={tile.label} className={`admin-stat-card admin-stat-${tile.tone}`}>
            <div className="admin-stat-icon">
              <tile.icon size={22} strokeWidth={2} />
            </div>
            <div className="admin-stat-meta">
              <span className="admin-stat-label">{tile.label}</span>
              <span className="admin-stat-value">{tile.value}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="admin-card">
        <div className="admin-card-header">
          <div className="admin-card-title">
            <Repeat size={18} strokeWidth={2} />
            <h2>Member Activity Breakdown</h2>
          </div>
        </div>
        <div className="admin-retention-bar">
          {statusOptions.filter((x) => x !== 'all').map((status) => {
            const meta = statusInfo(status)
            const count = s[status] ?? 0
            const pct = s.total ? Math.round((count / s.total) * 100) : 0
            return (
              <div className="admin-retention-seg" key={status}>
                <span className="admin-retention-dot" style={{ background: meta.color }} />
                <span className="admin-retention-seg-label">{meta.label}</span>
                <span className="admin-retention-seg-count">{count}</span>
                <div className="admin-retention-track">
                  <div className="admin-retention-bar" style={{ width: `${pct}%`, background: meta.color }} />
                </div>
                <span className="admin-retention-seg-pct">{pct}%</span>
              </div>
            )
          })}
        </div>
      </div>

      <div className="admin-toolbar-row">
        <div className="admin-search">
          <Search size={16} strokeWidth={2} />
          <input
            type="text"
            placeholder="Search members by name or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="admin-filter-chips">
          {statusOptions.map((status) => {
            const label = status === 'all' ? 'All' : statusInfo(status).label
            const active = statusFilter === status
            return (
              <button
                key={status}
                type="button"
                className={`admin-filter-chip${active ? ' active' : ''}`}
                onClick={() => setStatusFilter(status)}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="admin-empty-state">
          <Users size={30} strokeWidth={1.5} />
          <p>{searchTerm ? 'No matching members' : 'No members recorded yet'}</p>
        </div>
      ) : (
        <div className="admin-table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>Purpose</th>
                <th>Visits</th>
                <th>Last Visit</th>
                <th>Days Since</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const meta = statusInfo(r.status)
                return (
                  <tr key={r.id}>
                    <td>
                      <span className="admin-cell-strong">{r.name}</span>
                    </td>
                    <td>{r.phone || '—'}</td>
                    <td>{r.purpose || '—'}</td>
                    <td>{r.visit_count}</td>
                    <td>{formatDate(r.last_visit)}</td>
                    <td>{r.days_since_last != null ? `${r.days_since_last}d` : '—'}</td>
                    <td>
                      <span className="admin-status-pill" style={{ color: meta.color, background: `${meta.color}1a`, borderColor: `${meta.color}40` }}>
                        <span className="admin-status-dot" style={{ background: meta.color }}></span>
                        {meta.label}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default Retention
