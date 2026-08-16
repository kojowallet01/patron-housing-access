import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Users,
  Search,
  Download,
  Flag,
  ShieldCheck,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
  Pencil,
  Trash2,
  History,
  Printer,
  QrCode,
  X
} from 'lucide-react'
import { API_URL, getCampusAuthHeaders } from '../../config'
import { useAdminContext } from './AdminLayout'

const FLAG_SUGGESTIONS = [
  'Suspicious activity',
  'Loitering / no purpose',
  'Behavioral concern',
  'Unauthorized access',
  'Damaged property',
  'Harassment',
  'Other'
]

function Students() {
  const { activeCampus, refreshKey } = useAdminContext()
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [sortKey, setSortKey] = useState('created_at')
  const [sortDir, setSortDir] = useState('desc')

  const [editingStudent, setEditingStudent] = useState(null)
  const [editForm, setEditForm] = useState({ name: '', phone: '', purpose: '' })
  const [editMessage, setEditMessage] = useState({ type: '', text: '' })

  const [historyStudent, setHistoryStudent] = useState(null)
  const [historyVisits, setHistoryVisits] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)

  const [qrSheet, setQrSheet] = useState(null)
  const [qrLoading, setQrLoading] = useState(false)
  const [qrError, setQrError] = useState('')
  const [qrDate, setQrDate] = useState('')

  const [flagTarget, setFlagTarget] = useState(null)
  const [flagNote, setFlagNote] = useState('')
  const [flagMessage, setFlagMessage] = useState('')

  const fetchData = useCallback(async () => {
    try {
      const authHeaders = getCampusAuthHeaders(activeCampus)
      const res = await fetch(`${API_URL}/admin/students`, { headers: authHeaders })
      const data = await res.json()
      setStudents(data.students || [])
    } catch (error) {
      console.error('Error fetching students:', error)
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

  useEffect(() => {
    if (qrSheet) {
      document.body.classList.add('qr-print-mode')
    } else {
      document.body.classList.remove('qr-print-mode')
    }
    return () => document.body.classList.remove('qr-print-mode')
  }, [qrSheet])

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

  const openEdit = (student) => {
    setEditingStudent(student)
    setEditForm({ name: student.name || '', phone: student.phone || '', purpose: student.purpose || '' })
    setEditMessage({ type: '', text: '' })
  }

  const handleEditSave = async (e) => {
    e.preventDefault()
    setEditMessage({ type: '', text: '' })
    if (!editForm.name.trim() || !editForm.phone.trim()) {
      setEditMessage({ type: 'error', text: 'Name and phone are required.' })
      return
    }
    try {
      const authHeaders = getCampusAuthHeaders(activeCampus)
      const response = await fetch(`${API_URL}/admin/students/${editingStudent.id}`, {
        method: 'PUT',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(editForm)
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Update failed')
      setEditingStudent(null)
      fetchData()
    } catch (error) {
      setEditMessage({ type: 'error', text: error.message })
    }
  }

  const handleDelete = async (student) => {
    if (!window.confirm(`Remove ${student.name} and their visit history? This cannot be undone.`)) return
    try {
      const authHeaders = getCampusAuthHeaders(activeCampus)
      const response = await fetch(`${API_URL}/admin/students/${student.id}`, {
        method: 'DELETE',
        headers: authHeaders
      })
      if (!response.ok) throw new Error('Delete failed')
      fetchData()
    } catch (error) {
      console.error('Error deleting student:', error)
      window.alert('Unable to remove visitor. Please try again.')
    }
  }

  const openHistory = async (student) => {
    setHistoryStudent(student)
    setHistoryVisits([])
    setHistoryLoading(true)
    try {
      const authHeaders = getCampusAuthHeaders(activeCampus)
      const response = await fetch(`${API_URL}/admin/students/${student.id}/visits`, { headers: authHeaders })
      const data = await response.json()
      setHistoryVisits(data.visits || [])
    } catch (error) {
      console.error('Error fetching visit history:', error)
      setHistoryVisits([])
    } finally {
      setHistoryLoading(false)
    }
  }

  const openQrSheet = async (date = '') => {
    setQrLoading(true)
    setQrError('')
    try {
      const authHeaders = getCampusAuthHeaders(activeCampus)
      const query = date ? `?date=${encodeURIComponent(date)}` : ''
      const response = await fetch(`${API_URL}/admin/tokens/qr${query}`, { headers: authHeaders })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to load QR codes')
      setQrSheet(data)
      if (data.date) setQrDate(data.date)
    } catch (error) {
      setQrError(error.message || 'Unable to load QR codes')
    } finally {
      setQrLoading(false)
    }
  }

  const downloadQrSheet = () => {
    if (!qrSheet) return
    const rows = qrSheet.tokens.map(
      (t) => `
      <div class="qr-card">
        <img src="${t.tokenQR}" alt="QR code for ${t.name}" />
        <div class="qr-card-name">${t.name}</div>
        <div class="qr-card-token">${t.token}</div>
        <div class="qr-card-phone">${t.phone || ''}</div>
      </div>`
    ).join('')
    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Access QR Codes - ${activeCampus} - ${qrSheet.date}</title>
<style>
  body { font-family: Arial, sans-serif; margin: 24px; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  .sub { color: #666; font-size: 13px; margin-bottom: 20px; }
  .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
  .qr-card { border: 1px solid #ddd; border-radius: 8px; padding: 12px; text-align: center; page-break-inside: avoid; }
  .qr-card img { width: 180px; height: 180px; }
  .qr-card-name { font-weight: bold; margin-top: 6px; }
  .qr-card-token { font-size: 22px; letter-spacing: 4px; font-weight: bold; }
  .qr-card-phone { color: #666; font-size: 12px; margin-top: 2px; }
  @media print { body { margin: 12px; } .grid { grid-template-columns: repeat(4, 1fr); } }
</style>
</head>
<body>
  <h1>Access QR Codes — ${activeCampus}</h1>
  <div class="sub">Valid date: ${qrSheet.date} · ${qrSheet.tokens.length} code${qrSheet.tokens.length === 1 ? '' : 's'}</div>
  <div class="grid">${rows}
  </div>
</body>
</html>`
    const blob = new Blob([html], { type: 'text/html;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `access-qr-${activeCampus.replace(/\s+/g, '-').toLowerCase()}-${qrSheet.date}.html`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const downloadQrSheetPng = async () => {
    if (!qrSheet || !qrSheet.tokens.length) return
    const cols = 3
    const cardW = 320
    const cardH = 400
    const gap = 20
    const pad = 40
    const headerH = 50
    const rows = Math.ceil(qrSheet.tokens.length / cols)
    const canvasW = pad * 2 + cols * cardW + (cols - 1) * gap
    const canvasH = pad + headerH + rows * cardH + (rows - 1) * gap + pad

    const canvas = document.createElement('canvas')
    canvas.width = canvasW
    canvas.height = canvasH
    const ctx = canvas.getContext('2d')

    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvasW, canvasH)
    ctx.fillStyle = '#111827'
    ctx.font = 'bold 22px Arial, sans-serif'
    ctx.fillText(
      `Access QR Codes — ${activeCampus} · ${qrSheet.date} · ${qrSheet.tokens.length} code${qrSheet.tokens.length === 1 ? '' : 's'}`,
      pad,
      pad + 20
    )

    const loadImage = (src) =>
      new Promise((resolve, reject) => {
        const img = new Image()
        img.onload = () => resolve(img)
        img.onerror = reject
        img.src = src
      })

    for (let i = 0; i < qrSheet.tokens.length; i += 1) {
      const t = qrSheet.tokens[i]
      const col = i % cols
      const row = Math.floor(i / cols)
      const x = pad + col * (cardW + gap)
      const y = pad + headerH + row * (cardH + gap)

      ctx.fillStyle = '#ffffff'
      ctx.strokeStyle = '#d1d5db'
      ctx.lineWidth = 1
      roundRect(ctx, x, y, cardW, cardH, 12)
      ctx.stroke()

      const img = await loadImage(t.tokenQR)
      const qrSize = 200
      ctx.drawImage(img, x + (cardW - qrSize) / 2, y + 12, qrSize, qrSize)

      ctx.fillStyle = '#111827'
      ctx.font = 'bold 18px Arial, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(t.name || '', x + cardW / 2, y + 12 + qrSize + 34, cardW - 24)

      ctx.font = 'bold 30px Arial, monospace'
      ctx.fillText(t.token || '', x + cardW / 2, y + 12 + qrSize + 76)

      ctx.font = '14px Arial, sans-serif'
      ctx.fillStyle = '#6b7280'
      ctx.fillText(t.phone || '', x + cardW / 2, y + 12 + qrSize + 102)
    }

    const url = canvas.toDataURL('image/png')
    const link = document.createElement('a')
    link.href = url
    link.download = `access-qr-${activeCampus.replace(/\s+/g, '-').toLowerCase()}-${qrSheet.date}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const roundRect = (ctx, x, y, w, h, r) => {
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + w - r, y)
    ctx.quadraticCurveTo(x + w, y, x + w, y + r)
    ctx.lineTo(x + w, y + h - r)
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
    ctx.lineTo(x + r, y + h)
    ctx.quadraticCurveTo(x, y + h, x, y + h - r)
    ctx.lineTo(x, y + r)
    ctx.quadraticCurveTo(x, y, x + r, y)
    ctx.closePath()
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
    link.download = `students-${activeCampus.replace(/\s+/g, '-').toLowerCase()}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="admin-page-container">
        <div className="admin-loading-card">Loading students...</div>
      </div>
    )
  }

  return (
    <div className="admin-page-container">
      <div className="admin-page-heading">
        <div>
          <h1 className="admin-page-title">Students</h1>
          <p className="admin-page-subtitle">All registered students for {activeCampus}</p>
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
            <span className="admin-row-count">{filteredStudents.length} students</span>
            <button type="button" className="admin-btn admin-btn-outline" onClick={() => openQrSheet()}>
              <QrCode size={16} strokeWidth={2} />
              QR Codes
            </button>
            <button type="button" className="admin-btn admin-btn-outline" onClick={exportCSV}>
              <Download size={16} strokeWidth={2} />
              Export CSV
            </button>
          </div>
        </div>

        {filteredStudents.length === 0 ? (
          <div className="admin-empty-state">
            <Users size={32} strokeWidth={1.5} />
            <p>{searchTerm ? 'No matching students found' : 'No students registered yet'}</p>
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
                  <th>Actions</th>
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
                            setFlagTarget(student)
                            setFlagNote('')
                            setFlagMessage('')
                          }}
                        >
                          <Flag size={14} strokeWidth={2} />
                          Flag
                        </button>
                      )}
                    </td>
                    <td>
                      <div className="admin-row-actions">
                        <button
                          type="button"
                          className="admin-btn admin-btn-sm admin-btn-ghost"
                          title="View visit history"
                          onClick={() => openHistory(student)}
                        >
                          <History size={14} strokeWidth={2} />
                          History
                        </button>
                        <button
                          type="button"
                          className="admin-btn admin-btn-sm admin-btn-ghost"
                          title="Edit visitor details"
                          onClick={() => openEdit(student)}
                        >
                          <Pencil size={14} strokeWidth={2} />
                          Edit
                        </button>
                        <button
                          type="button"
                          className="admin-btn admin-btn-sm admin-btn-danger-ghost"
                          title="Remove visitor"
                          onClick={() => handleDelete(student)}
                        >
                          <Trash2 size={14} strokeWidth={2} />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editingStudent && (
        <div className="modal-overlay" onClick={() => setEditingStudent(null)}>
          <div className="modal admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h3>Edit Visitor</h3>
              <button type="button" className="admin-modal-close" onClick={() => setEditingStudent(null)} aria-label="Close">
                <X size={18} strokeWidth={2} />
              </button>
            </div>
            <form onSubmit={handleEditSave}>
              <div className="form-group">
                <label>Full Name</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Phone</label>
                <input
                  type="text"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Purpose</label>
                <input
                  type="text"
                  value={editForm.purpose}
                  onChange={(e) => setEditForm({ ...editForm, purpose: e.target.value })}
                />
              </div>

              {editMessage.text && (
                <div className={`alert ${editMessage.type === 'error' ? 'alert-error' : 'alert-success'}`}>
                  {editMessage.text}
                </div>
              )}

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setEditingStudent(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {flagTarget && (
        <div className="modal-overlay" onClick={() => setFlagTarget(null)}>
          <div className="modal admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h3>Flag {flagTarget.name}</h3>
              <button type="button" className="admin-modal-close" onClick={() => setFlagTarget(null)} aria-label="Close">
                <X size={18} strokeWidth={2} />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (!flagNote.trim()) {
                  setFlagMessage('Please enter a reason for flagging.')
                  return
                }
                handleFlag(flagTarget, true, flagNote.trim())
                setFlagTarget(null)
              }}
            >
              <div className="form-group">
                <label>Reason</label>
                <div className="flag-suggestions">
                  {FLAG_SUGGESTIONS.map((reason) => (
                    <button
                      key={reason}
                      type="button"
                      className={`flag-suggestion-chip${flagNote === reason ? ' active' : ''}`}
                      onClick={() => {
                        setFlagMessage('')
                        if (reason === 'Other') {
                          setFlagNote('')
                          document.getElementById('flag-note-input')?.focus()
                        } else {
                          setFlagNote(reason)
                        }
                      }}
                    >
                      {reason}
                    </button>
                  ))}
                </div>
                <textarea
                  id="flag-note-input"
                  rows="3"
                  placeholder={`Why is ${flagTarget.name} being flagged?`}
                  value={flagNote}
                  onChange={(e) => {
                    setFlagNote(e.target.value)
                    setFlagMessage('')
                  }}
                />
              </div>

              {flagMessage && <div className="alert alert-error">{flagMessage}</div>}

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setFlagTarget(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Flag Visitor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {historyStudent && (
        <div className="modal-overlay" onClick={() => setHistoryStudent(null)}>
          <div className="modal admin-modal admin-modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h3>Visit History — {historyStudent.name}</h3>
              <button type="button" className="admin-modal-close" onClick={() => setHistoryStudent(null)} aria-label="Close">
                <X size={18} strokeWidth={2} />
              </button>
            </div>
            <div className="admin-modal-subtitle">{historyStudent.phone || ''} · {historyStudent.purpose || 'No purpose'}</div>

            {historyLoading ? (
              <div className="admin-loading">Loading visit history...</div>
            ) : historyVisits.length === 0 ? (
              <div className="admin-empty-state">
                <History size={28} strokeWidth={1.5} />
                <p>No verified check-ins recorded yet</p>
              </div>
            ) : (
              <div className="admin-table-scroll">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Code</th>
                      <th>Purpose</th>
                      <th>Check-in Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyVisits.map((visit, index) => (
                      <tr key={visit.id || index}>
                        <td className="admin-table-index">{index + 1}</td>
                        <td><strong>{visit.token}</strong></td>
                        <td>{visit.purpose || '-'}</td>
                        <td>{new Date(visit.used_at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {qrSheet && (
        <div className="modal-overlay" onClick={() => setQrSheet(null)}>
          <div className="modal admin-modal admin-modal-xl" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <div>
                <h3>Access QR Codes — {activeCampus}</h3>
                <div className="admin-modal-subtitle">
                  Valid date: {qrSheet.date} · {qrSheet.tokens.length} code{qrSheet.tokens.length === 1 ? '' : 's'}
                </div>
              </div>
              <button type="button" className="admin-modal-close" onClick={() => setQrSheet(null)} aria-label="Close">
                <X size={18} strokeWidth={2} />
              </button>
            </div>

            {qrError && <div className="alert alert-error">{qrError}</div>}

            <div className="admin-modal-actions">
              <div className="admin-qr-date-picker">
                <label htmlFor="qr-sheet-date">Show codes for</label>
                <input
                  id="qr-sheet-date"
                  type="date"
                  value={qrDate}
                  onChange={(e) => {
                    if (e.target.value) openQrSheet(e.target.value)
                  }}
                />
              </div>
              <button type="button" className="admin-btn admin-btn-secondary" onClick={downloadQrSheet} disabled={!qrSheet.tokens.length}>
                <Download size={16} strokeWidth={2} />
                Download Sheet
              </button>
              <button
                type="button"
                className="admin-btn admin-btn-outline"
                onClick={downloadQrSheetPng}
                disabled={!qrSheet.tokens.length}
              >
                <Download size={16} strokeWidth={2} />
                Download PNG
              </button>
              <button
                type="button"
                className="admin-btn admin-btn-primary"
                onClick={() => window.print()}
                disabled={!qrSheet.tokens.length}
              >
                <Printer size={16} strokeWidth={2} />
                Print / Save as PDF
              </button>
            </div>

            {qrLoading && !qrSheet.tokens.length ? (
              <div className="admin-loading">Loading QR codes...</div>
            ) : qrSheet.tokens.length === 0 ? (
              <div className="admin-empty-state">
                <QrCode size={30} strokeWidth={1.5} />
                <p>No access codes generated for {qrSheet.date} yet.</p>
                <p className="admin-empty-state-sub">Codes appear once students register for this day.</p>
              </div>
            ) : (
              <div className="qr-sheet-grid">
                {qrSheet.tokens.map((t) => (
                  <div key={t.id} className="qr-sheet-card">
                    <img src={t.tokenQR} alt={`QR code for ${t.name}`} />
                    <div className="qr-sheet-name">{t.name}</div>
                    <div className="qr-sheet-token">{t.token}</div>
                    <div className="qr-sheet-phone">{t.phone || ''}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default Students
