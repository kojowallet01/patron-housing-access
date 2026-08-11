import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Users,
  Search,
  Download,
  Flag,
  ShieldCheck,
  ChevronUp,
  ChevronDown,
  ArrowUpDown
} from 'lucide-react'
import { API_URL, getCampusAuthHeaders } from '../../config'
import { useAdminContext } from './AdminLayout'

function Residents() {
  const { activeCampus, refreshKey } = useAdminContext()
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [sortKey, setSortKey] = useState('created_at')
  const [sortDir, setSortDir] = useState('desc')

  const fetchData = useCallback(async () => {
    try {
      const authHeaders = getCampusAuthHeaders(activeCampus)
      const res = await fetch(`${API_URL}/admin/students`, { headers: authHeaders })
      const data = await res.json()
      setStudents(data.students || [])
    } catch (error) {
      console.error('Error fetching residents:', error)
    } finally {
      setLoading(false)
    }
  }, [activeCampus])

  useEffect(() => {
    fetchData()
  }, [fetchData, refreshKey])

  useEffect(() => {
    const interval = setInterval(fetchData, 10000)
    return () => clearInterval(interval)
  }, [fetchData])

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

  const filteredStudents = useMemo(() => {
    let rows = students
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase()
      rows = rows.filter(
        (s) =>
          s.name.toLowerCase().includes(term) ||
          (s.phone || '').toLowerCase().includes(term) ||
          (s.purpose || '').toLowerCase().includes(term)
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
  }, [students, searchTerm, sortKey, sortDir])

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

  const exportCSV = () => {
    const header = ['Name', 'Phone', 'Purpose', 'Campus', 'Registered']
    const rows = filteredStudents.map((s) =>
      [
        `"${String(s.name || '').replace(/"/g, '""')}"`,
        `"${String(s.phone || '').replace(/"/g, '""')}"`,
        `"${String(s.purpose || '').replace(/"/g, '""')}"`,
        `"${String(s.campus || '').replace(/"/g, '""')}"`,
        `"${new Date(s.created_at).toLocaleString()}"`
      ].join(',')
    )
    const csv = [header.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `residents-${activeCampus.replace(/\s+/g, '-').toLowerCase()}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="admin-page-container">
        <div className="admin-loading-card">Loading residents...</div>
      </div>
    )
  }

  return (
    <div className="admin-page-container">
      <div className="admin-page-heading">
        <div>
          <h1 className="admin-page-title">Residents</h1>
          <p className="admin-page-subtitle">All registered residents for {activeCampus}</p>
        </div>
      </div>

      <div className="admin-card">
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
          <div className="admin-toolbar-actions">
            <span className="admin-row-count">{filteredStudents.length} residents</span>
            <button type="button" className="admin-btn admin-btn-outline" onClick={exportCSV}>
              <Download size={16} strokeWidth={2} />
              Export CSV
            </button>
          </div>
        </div>

        {filteredStudents.length === 0 ? (
          <div className="admin-empty-state">
            <Users size={32} strokeWidth={1.5} />
            <p>{searchTerm ? 'No matching residents found' : 'No residents registered yet'}</p>
          </div>
        ) : (
          <div className="admin-table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <SortHeader label="Name" sortValue="name" />
                  <SortHeader label="Phone" sortValue="phone" />
                  <SortHeader label="Purpose" sortValue="purpose" />
                  <SortHeader label="Registered" sortValue="created_at" />
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((student) => (
                  <tr key={student.id} className={student.flagged ? 'admin-row-flagged' : ''}>
                    <td>
                      <span className="admin-cell-strong">{student.name}</span>
                      {student.flagged && (
                        <span className="admin-badge admin-badge-warning">
                          <Flag size={12} strokeWidth={2} />
                          Flagged
                        </span>
                      )}
                    </td>
                    <td>{student.phone || '-'}</td>
                    <td>{student.purpose || '-'}</td>
                    <td>{new Date(student.created_at).toLocaleString()}</td>
                    <td>
                      {student.flagged ? (
                        <button
                          type="button"
                          className="admin-btn admin-btn-sm admin-btn-warning"
                          onClick={() => handleFlag(student, false, '')}
                        >
                          <ShieldCheck size={14} strokeWidth={2} />
                          Clear Flag
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="admin-btn admin-btn-sm admin-btn-outline"
                          onClick={() => {
                            const note = window.prompt(`Flag ${student.name} — reason:`) || ''
                            if (note.trim()) {
                              handleFlag(student, true, note.trim())
                            }
                          }}
                        >
                          <Flag size={14} strokeWidth={2} />
                          Flag
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default Residents
