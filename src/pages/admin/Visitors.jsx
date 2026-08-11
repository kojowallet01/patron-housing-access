import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  UserCheck,
  Users,
  Repeat,
  UserPlus,
  Clock,
  Tag,
  Search,
  Download,
  Calendar,
  Plus,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
  X
} from 'lucide-react'
import { API_URL, getCampusAuthHeaders } from '../../config'
import { useAdminContext } from './AdminLayout'

const HOUR_LABELS = ['12a','1a','2a','3a','4a','5a','6a','7a','8a','9a','10a','11a','12p','1p','2p','3p','4p','5p','6p','7p','8p','9p','10p','11p']

function Visitors() {
  const { activeCampus, refreshKey } = useAdminContext()
  const [visitors, setVisitors] = useState([])
  const [students, setStudents] = useState([])
  const [rangeInfo, setRangeInfo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [sortKey, setSortKey] = useState('used_at')
  const [sortDir, setSortDir] = useState('desc')

  const [preset, setPreset] = useState('day')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  const [showAddForm, setShowAddForm] = useState(false)
  const [addForm, setAddForm] = useState({ name: '', phone: '', purpose: '' })
  const [addMessage, setAddMessage] = useState({ type: '', text: '' })

  const fetchVisitors = useCallback(async () => {
    try {
      setLoading(true)
      const authHeaders = getCampusAuthHeaders(activeCampus)
      let url = `${API_URL}/admin/visits?range=${preset}&campus=${encodeURIComponent(activeCampus)}`
      if (preset === 'custom' && customStart && customEnd) {
        url = `${API_URL}/admin/visits?start=${customStart}&end=${customEnd}&campus=${encodeURIComponent(activeCampus)}`
      }
      const [visitsRes, studentsRes] = await Promise.all([
        fetch(url, { headers: authHeaders }),
        fetch(`${API_URL}/admin/students`, { headers: authHeaders })
      ])
      if (!visitsRes.ok) return
      const visitsData = await visitsRes.json()
      const studentsData = await studentsRes.json()
      setVisitors(visitsData.students || [])
      setStudents(studentsData.students || [])
      setRangeInfo(visitsData)
    } catch (error) {
      console.error('Error fetching visitors:', error)
    } finally {
      setLoading(false)
    }
  }, [activeCampus, preset, customStart, customEnd])

  useEffect(() => {
    fetchVisitors()
  }, [fetchVisitors, refreshKey])

  useEffect(() => {
    const interval = setInterval(() => fetchVisitors(), 15000)
    return () => clearInterval(interval)
  }, [fetchVisitors])

  const analytics = useMemo(() => {
    const peakHours = Array(24).fill(0)
    const purposeCounts = {}
    const visitorCounts = {}
    visitors.forEach((v) => {
      const hour = new Date(v.used_at).getHours()
      peakHours[hour] += 1
      const purpose = v.purpose || 'Not specified'
      purposeCounts[purpose] = (purposeCounts[purpose] || 0) + 1
      visitorCounts[v.phone] = (visitorCounts[v.phone] || 0) + 1
    })
    const uniqueVisitors = Object.keys(visitorCounts).length
    const returningVisitors = Object.values(visitorCounts).filter((count) => count > 1).length
    const purposes = Object.entries(purposeCounts)
      .map(([purpose, count]) => ({ purpose, count }))
      .sort((a, b) => b.count - a.count)

    let newSignups = 0
    if (rangeInfo?.start && rangeInfo?.end) {
      const start = rangeInfo.start
      const end = rangeInfo.end
      newSignups = students.filter((s) => {
        const created = (s.created_at || '').slice(0, 10)
        return created >= start && created <= end
      }).length
    }

    return { totalVisits: visitors.length, uniqueVisitors, returningVisitors, newSignups, peakHours, purposes }
  }, [visitors, students, rangeInfo])

  const maxHour = Math.max(...analytics.peakHours, 1)
  const maxPurpose = Math.max(...analytics.purposes.map((p) => p.count), 1)

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const SortHeader = ({ label, sortValue }) => (
    <th className="admin-th-sortable" onClick={() => handleSort(sortValue)}>
      <span>{label}</span>
      {sortKey === sortValue ? (
        sortDir === 'asc' ? <ChevronUp size={14} strokeWidth={2.5} /> : <ChevronDown size={14} strokeWidth={2.5} />
      ) : (
        <ArrowUpDown size={14} strokeWidth={2} />
      )}
    </th>
  )

  const filteredVisitors = useMemo(() => {
    let rows = visitors
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase()
      rows = rows.filter(
        (v) =>
          v.name.toLowerCase().includes(term) ||
          (v.phone || '').toLowerCase().includes(term) ||
          (v.purpose || '').toLowerCase().includes(term)
      )
    }
    return [...rows].sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1
      const av = a[sortKey]
      const bv = b[sortKey]
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      return String(av).localeCompare(String(bv), undefined, { numeric: true }) * dir
    })
  }, [visitors, searchTerm, sortKey, sortDir])

  const exportCSV = () => {
    const header = ['Name', 'Phone', 'Purpose', 'Campus', 'Entry Time']
    const rows = filteredVisitors.map((v) =>
      [
        `"${String(v.name || '').replace(/"/g, '""')}"`,
        `"${String(v.phone || '').replace(/"/g, '""')}"`,
        `"${String(v.purpose || '').replace(/"/g, '""')}"`,
        `"${String(v.campus || '').replace(/"/g, '""')}"`,
        `"${new Date(v.used_at).toLocaleString()}"`
      ].join(',')
    )
    const csv = [header.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `visitors-${new Date().toISOString().split('T')[0]}.csv`
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
    } catch (error) {
      console.error('Error adding visitor:', error)
      setAddMessage({ type: 'error', text: 'Unable to add visitor right now.' })
    }
  }

  const statTiles = [
    { label: 'Total Visits', value: analytics.totalVisits, icon: Clock, tone: 'indigo' },
    { label: 'Unique Visitors', value: analytics.uniqueVisitors, icon: Users, tone: 'emerald' },
    { label: 'Returning', value: analytics.returningVisitors, icon: Repeat, tone: 'amber' },
    { label: 'New Signups', value: analytics.newSignups, icon: UserPlus, tone: 'sky' }
  ]

  return (
    <div className="admin-page-container">
      <div className="admin-page-heading">
        <div>
          <h1 className="admin-page-title">Visitors</h1>
          <p className="admin-page-subtitle">Analytics and visitor log for {activeCampus}</p>
        </div>
      </div>

      <div className="admin-card admin-filters-card">
        <div className="admin-preset-tabs">
          {[
            { value: 'day', label: 'Today' },
            { value: 'week', label: 'This Week' },
            { value: 'month', label: 'This Month' },
            { value: 'custom', label: 'Custom Range' }
          ].map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`admin-preset-tab${preset === opt.value ? ' active' : ''}`}
              onClick={() => setPreset(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {preset === 'custom' && (
          <div className="admin-date-range">
            <div className="admin-date-field">
              <Calendar size={16} strokeWidth={2} />
              <label>From</label>
              <input
                type="date"
                value={customStart}
                max={customEnd || undefined}
                onChange={(e) => setCustomStart(e.target.value)}
              />
            </div>
            <span className="admin-date-sep">to</span>
            <div className="admin-date-field">
              <Calendar size={16} strokeWidth={2} />
              <label>To</label>
              <input
                type="date"
                value={customEnd}
                min={customStart || undefined}
                onChange={(e) => setCustomEnd(e.target.value)}
              />
            </div>
            {(customStart || customEnd) && (
              <button
                type="button"
                className="admin-btn admin-btn-sm admin-btn-ghost"
                onClick={() => {
                  setCustomStart('')
                  setCustomEnd('')
                }}
              >
                <X size={14} strokeWidth={2} />
                Clear
              </button>
            )}
          </div>
        )}

        {rangeInfo && (
          <span className="admin-period-badge">
            {rangeInfo.start} → {rangeInfo.end}
          </span>
        )}
      </div>

      <div className="admin-stats-grid admin-stats-grid-4">
        {statTiles.map((tile) => (
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

      <div className="admin-layout-two-col">
        <div className="admin-col-main">
          <div className="admin-card">
            <div className="admin-card-header">
              <div className="admin-card-title">
                <Clock size={18} strokeWidth={2} />
                <h2>Visits by Hour</h2>
              </div>
            </div>
            <div className="admin-hour-chart">
              {analytics.peakHours.map((count, hour) => (
                <div className="admin-hour-col" key={hour} title={`${HOUR_LABELS[hour]} — ${count}`}>
                  <div className="admin-hour-bar-wrap">
                    <div className="admin-hour-bar" style={{ height: `${Math.max((count / maxHour) * 100, count > 0 ? 4 : 1)}%` }} />
                  </div>
                  <span className="admin-hour-count">{count > 0 ? count : ''}</span>
                </div>
              ))}
            </div>
            <div className="admin-hour-axis">
              {[0, 6, 12, 18, 23].map((h) => (
                <span key={h}>{HOUR_LABELS[h]}</span>
              ))}
            </div>
          </div>

          <div className="admin-card">
            <div className="admin-card-header">
              <div className="admin-card-title">
                <Tag size={18} strokeWidth={2} />
                <h2>Visits by Purpose</h2>
              </div>
            </div>
            {analytics.purposes.length === 0 ? (
              <div className="admin-empty-state">
                <p>No visits in this period</p>
              </div>
            ) : (
              <div className="admin-purpose-list">
                {analytics.purposes.slice(0, 6).map((p) => (
                  <div key={p.purpose} className="admin-purpose-row">
                    <span className="admin-purpose-label">{p.purpose}</span>
                    <div className="admin-purpose-track">
                      <div
                        className="admin-purpose-bar"
                        style={{ width: `${Math.round((p.count / maxPurpose) * 100)}%` }}
                      />
                    </div>
                    <span className="admin-purpose-count">{p.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="admin-col-side">
          <div className="admin-card">
            <div className="admin-card-header">
              <div className="admin-card-title">
                <UserCheck size={18} strokeWidth={2} />
                <h2>Visitor Log</h2>
              </div>
            </div>

            <div className="admin-table-toolbar admin-table-toolbar-stacked">
              <div className="admin-search">
                <Search size={16} strokeWidth={2} />
                <input
                  type="text"
                  placeholder="Search visitors..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="admin-toolbar-actions">
                <button type="button" className="admin-btn admin-btn-outline" onClick={exportCSV}>
                  <Download size={16} strokeWidth={2} />
                  Export CSV
                </button>
                <button type="button" className="admin-btn admin-btn-primary" onClick={() => setShowAddForm(true)}>
                  <Plus size={16} strokeWidth={2} />
                  Add Visitor
                </button>
              </div>
            </div>

            {loading && visitors.length === 0 ? (
              <div className="admin-empty-state">Loading visitors...</div>
            ) : filteredVisitors.length === 0 ? (
              <div className="admin-empty-state">
                <UserCheck size={30} strokeWidth={1.5} />
                <p>{searchTerm ? 'No matching visitors' : 'No visitors in this period'}</p>
              </div>
            ) : (
              <div className="admin-table-scroll">
                <table className="admin-table admin-table-compact">
                  <thead>
                    <tr>
                      <SortHeader label="Name" sortValue="name" />
                      <SortHeader label="Phone" sortValue="phone" />
                      <SortHeader label="Purpose" sortValue="purpose" />
                      <SortHeader label="Entry" sortValue="used_at" />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredVisitors.map((visitor, index) => (
                      <tr key={index}>
                        <td>
                          <span className="admin-cell-strong">{visitor.name}</span>
                        </td>
                        <td>{visitor.phone || '-'}</td>
                        <td>{visitor.purpose || '-'}</td>
                        <td>{new Date(visitor.used_at).toLocaleTimeString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {showAddForm && (
        <div className="modal-overlay" onClick={() => setShowAddForm(false)}>
          <div className="modal admin-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Add Visitor to {activeCampus}</h3>
            <p className="modal-subtitle">Add a resident or visitor without the QR registration flow.</p>

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

export default Visitors
