import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, BookOpen, CalendarDays, Check, Clock3, MapPin, Save, Users, X } from 'lucide-react'
import { API_URL, getCampusAuthHeaders } from '../../config'
import { useAdminContext } from './AdminLayout'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const TODAY = (() => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Accra',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
  return `${values.year}-${values.month}-${values.day}`
})()
const WEEK_AGO = (() => {
  const date = new Date(`${TODAY}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() - 6)
  return date.toISOString().slice(0, 10)
})()

const EMPTY_TERM = { name: '', start_date: TODAY, end_date: '', status: 'inactive' }
const EMPTY_CLASS = {
  term_id: '',
  title: '',
  description: '',
  day_of_week: '1',
  start_time: '10:00',
  end_time: '11:00',
  classroom: '',
  capacity: '30',
  instructor: '',
  status: 'draft'
}

async function readJson(response, fallback) {
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(result.error || fallback)
  return result
}

function Classes() {
  const { activeCampus, refreshKey } = useAdminContext()
  const [terms, setTerms] = useState([])
  const [classes, setClasses] = useState([])
  const [selectedTerm, setSelectedTerm] = useState('')
  const [termForm, setTermForm] = useState(EMPTY_TERM)
  const [editingTerm, setEditingTerm] = useState('')
  const [classForm, setClassForm] = useState(EMPTY_CLASS)
  const [editingClass, setEditingClass] = useState('')
  const [reportDate, setReportDate] = useState(TODAY)
  const [reportClassId, setReportClassId] = useState('')
  const [studentSearch, setStudentSearch] = useState('')
  const [report, setReport] = useState(null)
  const [analyticsStartDate, setAnalyticsStartDate] = useState(WEEK_AGO)
  const [analyticsEndDate, setAnalyticsEndDate] = useState(TODAY)
  const [analytics, setAnalytics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const headers = getCampusAuthHeaders(activeCampus)

  const loadTerms = useCallback(async () => {
    const response = await fetch(`${API_URL}/admin/academic-terms`, { headers: getCampusAuthHeaders(activeCampus) })
    const result = await readJson(response, 'Unable to load academic terms.')
    setTerms(result.terms || [])
    setSelectedTerm((current) => current && result.terms.some((term) => term.id === current)
      ? current
      : result.terms.find((term) => term.status === 'active')?.id || result.terms[0]?.id || '')
  }, [activeCampus])

  const loadClasses = useCallback(async (termId = selectedTerm) => {
    const query = termId ? `?term_id=${encodeURIComponent(termId)}` : ''
    const response = await fetch(`${API_URL}/admin/classes${query}`, { headers: getCampusAuthHeaders(activeCampus) })
    const result = await readJson(response, 'Unable to load classes.')
    setClasses(result.classes || [])
  }, [activeCampus, selectedTerm])

  const loadReport = useCallback(async (date = reportDate, classId = reportClassId) => {
    const query = new URLSearchParams({ date })
    if (classId) query.set('class_id', classId)
    const response = await fetch(`${API_URL}/admin/classes/attendance?${query}`, {
      headers: getCampusAuthHeaders(activeCampus)
    })
    const result = await readJson(response, 'Unable to load class attendance.')
    setReport(result)
  }, [activeCampus, reportClassId, reportDate])

  const loadAnalytics = useCallback(async (startDate = WEEK_AGO, endDate = TODAY) => {
    const query = new URLSearchParams({ start_date: startDate, end_date: endDate })
    const response = await fetch(`${API_URL}/admin/classes/analytics?${query}`, {
      headers: getCampusAuthHeaders(activeCampus)
    })
    const result = await readJson(response, 'Unable to load class analytics.')
    setAnalytics(result)
  }, [activeCampus])

  useEffect(() => {
    let active = true
    setLoading(true)
    Promise.all([loadTerms(), loadReport(), loadAnalytics()])
      .catch((loadError) => {
        if (active) setError(loadError.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [loadTerms, loadReport, loadAnalytics, refreshKey])

  useEffect(() => {
    if (!selectedTerm) {
      setClasses([])
      return
    }
    loadClasses().catch((loadError) => setError(loadError.message))
  }, [loadClasses, selectedTerm])

  const resetTermForm = () => {
    setTermForm(EMPTY_TERM)
    setEditingTerm('')
  }

  const resetClassForm = () => {
    setClassForm({ ...EMPTY_CLASS, term_id: selectedTerm })
    setEditingClass('')
  }

  const saveTerm = async (event) => {
    event.preventDefault()
    setSaving(true)
    setMessage('')
    setError('')
    try {
      const response = await fetch(`${API_URL}/admin/academic-terms`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...termForm, id: editingTerm || undefined })
      })
      const result = await readJson(response, 'Unable to save the academic term.')
      setMessage(`Saved ${result.term.name}.`)
      setEditingTerm('')
      setTermForm(EMPTY_TERM)
      await loadTerms()
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setSaving(false)
    }
  }

  const saveClass = async (event) => {
    event.preventDefault()
    setSaving(true)
    setMessage('')
    setError('')
    try {
      const response = await fetch(`${API_URL}/admin/classes`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...classForm,
          term_id: classForm.term_id || selectedTerm,
          id: editingClass || undefined,
          day_of_week: Number(classForm.day_of_week),
          capacity: Number(classForm.capacity)
        })
      })
      const result = await readJson(response, 'Unable to save the class.')
      const notices = result.notifications
      setMessage(notices?.accepted || notices?.skipped || notices?.failed
        ? `Saved ${result.class.title}. Change notices: ${notices.accepted} accepted, ${notices.skipped} skipped, ${notices.failed} failed.`
        : `Saved ${result.class.title}.`)
      setEditingClass('')
      setClassForm({ ...EMPTY_CLASS, term_id: selectedTerm })
      await loadClasses(selectedTerm)
      await loadReport()
      await loadAnalytics(analyticsStartDate, analyticsEndDate)
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setSaving(false)
    }
  }

  const editTerm = (term) => {
    setEditingTerm(term.id)
    setTermForm({
      name: term.name,
      start_date: term.start_date,
      end_date: term.end_date,
      status: term.status
    })
  }

  const editClass = (classSchedule) => {
    setEditingClass(classSchedule.id)
    setClassForm({
      term_id: classSchedule.term_id,
      title: classSchedule.title,
      description: classSchedule.description || '',
      day_of_week: String(classSchedule.day_of_week),
      start_time: classSchedule.start_time,
      end_time: classSchedule.end_time,
      classroom: classSchedule.classroom,
      capacity: String(classSchedule.capacity),
      instructor: classSchedule.instructor || '',
      status: classSchedule.status
    })
  }

  const recordAttendance = async (bookingId, status) => {
    setError('')
    setMessage('')
    try {
      const response = await fetch(`${API_URL}/admin/classes/bookings/${bookingId}/attendance`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      })
      await readJson(response, 'Unable to record class attendance.')
      setMessage(`Class attendance marked ${status}.`)
      await Promise.all([
        loadReport(),
        loadAnalytics(analyticsStartDate, analyticsEndDate)
      ])
    } catch (saveError) {
      setError(saveError.message)
    }
  }

  const changeReportDate = async (date) => {
    setReportDate(date)
    setError('')
    try {
      await loadReport(date, reportClassId)
    } catch (loadError) {
      setError(loadError.message)
    }
  }

  const changeReportClass = async (classId) => {
    setReportClassId(classId)
    setError('')
    try {
      await loadReport(reportDate, classId)
    } catch (loadError) {
      setError(loadError.message)
    }
  }

  const refreshAnalytics = async () => {
    setError('')
    try {
      await loadAnalytics(analyticsStartDate, analyticsEndDate)
    } catch (loadError) {
      setError(loadError.message)
    }
  }

  const searchQuery = studentSearch.trim().toLowerCase()
  const visibleRoster = (report?.roster || []).filter((booking) =>
    !searchQuery || booking.student_name?.toLowerCase().includes(searchQuery) ||
      booking.student_phone?.toLowerCase().includes(searchQuery)
  )
  const visibleCampusOnly = (report?.campusOnly || []).filter((student) =>
    !searchQuery || student.name?.toLowerCase().includes(searchQuery) ||
      student.phone?.toLowerCase().includes(searchQuery)
  )

  const exportAttendanceCsv = () => {
    if (!report) return
    const escape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`
    const rows = [
      ['Date', 'Student', 'Phone', 'Class', 'Start', 'End', 'Room', 'Campus entry', 'Campus check-in time', 'Class attendance', 'Booking status'],
      ...visibleRoster.map((booking) => [
        report.date,
        booking.student_name,
        booking.student_phone,
        booking.class_title_snapshot,
        booking.start_time_snapshot,
        booking.end_time_snapshot,
        booking.classroom_snapshot,
        booking.campus_attended ? 'Entered' : 'Not entered',
        booking.campus_entry_at || '',
        booking.class_attendance,
        booking.status
      ]),
      ...visibleCampusOnly.map((student) => [
        report.date,
        student.name,
        student.phone,
        '',
        '',
        '',
        '',
        'Entered',
        student.verified_at || '',
        'No class booking',
        ''
      ])
    ]
    const content = rows.map((row) => row.map(escape).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `class-attendance-${report.date}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return <div className="admin-page-container"><div className="admin-loading-card">Loading class timetable…</div></div>
  }

  return (
    <div className="admin-page-container class-admin-page">
      <div className="admin-page-heading">
        <div>
          <h1 className="admin-page-title">Classes & attendance</h1>
          <p className="admin-page-subtitle">Manage the campus timetable, bookings, and class attendance independently from building access.</p>
        </div>
        <span className="admin-card-badge">{activeCampus}</span>
      </div>

      {message && <div className="class-notice class-notice-success" role="status"><Check size={17} /> {message}</div>}
      {error && <div className="class-notice class-notice-error" role="alert"><AlertCircle size={17} /> {error}</div>}

      <section className="admin-card">
        <div className="admin-card-header">
          <div className="admin-card-title"><CalendarDays size={18} /><h2>Academic terms</h2></div>
          <span className="admin-card-badge">{terms.length} term{terms.length === 1 ? '' : 's'}</span>
        </div>
        <form className="class-admin-form" onSubmit={saveTerm}>
          <label>Term name<input required maxLength={100} value={termForm.name} onChange={(event) => setTermForm({ ...termForm, name: event.target.value })} /></label>
          <label>Starts<input type="date" required value={termForm.start_date} onChange={(event) => setTermForm({ ...termForm, start_date: event.target.value })} /></label>
          <label>Ends<input type="date" required min={termForm.start_date} value={termForm.end_date} onChange={(event) => setTermForm({ ...termForm, end_date: event.target.value })} /></label>
          <label>Status<select value={termForm.status} onChange={(event) => setTermForm({ ...termForm, status: event.target.value })}><option value="inactive">Inactive</option><option value="active">Active timetable</option></select></label>
          <div className="class-form-actions">
            <button type="submit" className="admin-btn admin-btn-primary" disabled={saving}><Save size={15} /> {editingTerm ? 'Save term' : 'Add term'}</button>
            {editingTerm && <button type="button" className="admin-btn admin-btn-secondary" onClick={resetTermForm}><X size={15} /> Cancel</button>}
          </div>
        </form>
        <div className="class-term-list">
          {terms.map((term) => (
            <article key={term.id} className={`class-term-row${term.id === selectedTerm ? ' selected' : ''}`}>
              <button type="button" className="class-term-select" onClick={() => setSelectedTerm(term.id)}>
                <strong>{term.name}</strong>
                <span>{term.start_date} to {term.end_date} · {term.status === 'active' ? 'Active' : 'Inactive'}</span>
              </button>
              <button type="button" className="admin-btn admin-btn-secondary" onClick={() => editTerm(term)}>Edit</button>
            </article>
          ))}
          {terms.length === 0 && <p className="class-empty-state">Create a term and mark it active to publish its classes to students.</p>}
        </div>
      </section>

      <section className="admin-card">
        <div className="admin-card-header">
          <div className="admin-card-title"><BookOpen size={18} /><h2>Weekly timetable</h2></div>
          {terms.length > 0 && (
            <select aria-label="Select academic term" value={selectedTerm} onChange={(event) => setSelectedTerm(event.target.value)}>
              {terms.map((term) => <option key={term.id} value={term.id}>{term.name}{term.status === 'active' ? ' · Active' : ''}</option>)}
            </select>
          )}
        </div>
        <form className="class-admin-form" onSubmit={saveClass}>
          <label>Class name<input required maxLength={120} value={classForm.title} onChange={(event) => setClassForm({ ...classForm, title: event.target.value })} /></label>
          <label>Day<select value={classForm.day_of_week} onChange={(event) => setClassForm({ ...classForm, day_of_week: event.target.value })}>{DAYS.map((day, index) => <option key={day} value={index}>{day}</option>)}</select></label>
          <label>Starts<input type="time" required value={classForm.start_time} onChange={(event) => setClassForm({ ...classForm, start_time: event.target.value })} /></label>
          <label>Ends<input type="time" required value={classForm.end_time} onChange={(event) => setClassForm({ ...classForm, end_time: event.target.value })} /></label>
          <label>Classroom<input required maxLength={100} value={classForm.classroom} onChange={(event) => setClassForm({ ...classForm, classroom: event.target.value })} /></label>
          <label>Capacity<input type="number" min="1" max="5000" required value={classForm.capacity} onChange={(event) => setClassForm({ ...classForm, capacity: event.target.value })} /></label>
          <label>Instructor (optional)<input maxLength={120} value={classForm.instructor} onChange={(event) => setClassForm({ ...classForm, instructor: event.target.value })} /></label>
          <label>Registration status<select value={classForm.status} onChange={(event) => setClassForm({ ...classForm, status: event.target.value })}>
            <option value="draft">Draft — unpublished</option>
            <option value="published">Published — open</option>
            <option value="disabled">Temporarily closed</option>
            <option value="cancelled">Cancelled</option>
          </select></label>
          <label className="class-description-field">Description<textarea rows="2" maxLength={2000} value={classForm.description} onChange={(event) => setClassForm({ ...classForm, description: event.target.value })} /></label>
          <div className="class-form-actions">
            <button type="submit" className="admin-btn admin-btn-primary" disabled={saving || !selectedTerm}><Save size={15} /> {editingClass ? 'Save class' : 'Add class'}</button>
            {editingClass && <button type="button" className="admin-btn admin-btn-secondary" onClick={resetClassForm}><X size={15} /> Cancel edit</button>}
          </div>
        </form>

        <div className="class-admin-list">
          {classes.map((classSchedule) => (
            <article className="class-admin-row" key={classSchedule.id}>
              <div>
                <span className={`class-status-pill class-status-${classSchedule.status}`}>{classSchedule.status.replace('_', ' ')}</span>
                <h3>{classSchedule.title}</h3>
                <p><CalendarDays size={14} /> Every {DAYS[classSchedule.day_of_week]} <Clock3 size={14} /> {classSchedule.start_time}–{classSchedule.end_time} <MapPin size={14} /> {classSchedule.classroom} <Users size={14} /> {classSchedule.capacity} seats</p>
                {classSchedule.description && <small>{classSchedule.description}</small>}
              </div>
              <button type="button" className="admin-btn admin-btn-secondary" onClick={() => editClass(classSchedule)}>Edit</button>
            </article>
          ))}
          {selectedTerm && classes.length === 0 && <p className="class-empty-state">No classes in this term. Add a class using the timetable form.</p>}
        </div>
      </section>

      <section className="admin-card">
        <div className="admin-card-header">
          <div className="admin-card-title"><Users size={18} /><h2>Class attendance report</h2></div>
          <div className="class-report-filters">
            <label>Class
              <select value={reportClassId} onChange={(event) => changeReportClass(event.target.value)}>
                <option value="">All classes</option>
                {classes.map((classSchedule) => <option key={classSchedule.id} value={classSchedule.id}>{classSchedule.title}</option>)}
              </select>
            </label>
            <label className="class-report-date">Class date<input type="date" value={reportDate} onChange={(event) => changeReportDate(event.target.value)} /></label>
            <button type="button" className="admin-btn admin-btn-secondary" onClick={exportAttendanceCsv} disabled={!report}>Export CSV</button>
          </div>
        </div>
        {report && (
          <>
            <div className="class-report-summary">
              <span><strong>{report.summary.campusEntries}</strong> campus entries</span>
              <span><strong>{report.summary.classBookings}</strong> class bookings</span>
              <span><strong>{report.summary.present}</strong> attended</span>
              <span><strong>{report.summary.absent}</strong> marked absent</span>
              <span><strong>{report.summary.pending}</strong> pending</span>
              <span><strong>{report.summary.enteredWithoutClassBooking}</strong> entered without a class booking</span>
              <span><strong>{report.summary.bookedWithoutCampusEntry}</strong> booked but no campus entry</span>
            </div>
            <div className="class-report-table-wrap">
              <label className="class-report-search">Search student
                <input value={studentSearch} onChange={(event) => setStudentSearch(event.target.value)} placeholder="Name or phone" />
              </label>
              <table className="class-report-table">
                <thead><tr><th>Student / class</th><th>Class time</th><th>Campus entry</th><th>Class attendance</th><th>Record</th></tr></thead>
                <tbody>
                  {visibleRoster.map((booking) => (
                    <tr key={booking.id}>
                      <td><strong>{booking.student_name}</strong><small>{booking.student_phone}</small><small>{booking.class_title_snapshot}</small></td>
                      <td>{booking.start_time_snapshot}–{booking.end_time_snapshot}<small>{booking.classroom_snapshot}</small></td>
                      <td>{booking.campus_attended ? 'Entered campus' : 'No campus entry'}{booking.campus_entry_at && <small>{new Date(booking.campus_entry_at).toLocaleTimeString('en-GH', { timeZone: 'Africa/Accra', hour: '2-digit', minute: '2-digit' })}</small>}</td>
                      <td>{booking.class_attendance}</td>
                      <td>
                        {booking.status === 'booked' ? (
                          <div className="class-attendance-actions">
                            <button type="button" className="admin-btn admin-btn-secondary" onClick={() => recordAttendance(booking.id, 'present')}>Present</button>
                            <button type="button" className="admin-btn admin-btn-secondary" onClick={() => recordAttendance(booking.id, 'absent')}>Absent</button>
                          </div>
                        ) : <span>—</span>}
                      </td>
                    </tr>
                  ))}
                  {visibleRoster.length === 0 && <tr><td colSpan="5">No matching class bookings for this date.</td></tr>}
                </tbody>
              </table>
            </div>
            {visibleCampusOnly.length > 0 && (
              <div className="class-campus-only">
                <h3>Campus entries without class bookings</h3>
                {visibleCampusOnly.map((student, index) => <p key={`${student.student_id}-${index}`}>{student.name} · {student.phone} · {student.verified_at}</p>)}
              </div>
            )}
          </>
        )}
      </section>

      <section className="admin-card">
        <div className="admin-card-header">
          <div className="admin-card-title"><CalendarDays size={18} /><h2>Class analytics</h2></div>
          <div className="class-report-filters">
            <label>From<input type="date" value={analyticsStartDate} onChange={(event) => setAnalyticsStartDate(event.target.value)} /></label>
            <label>To<input type="date" value={analyticsEndDate} onChange={(event) => setAnalyticsEndDate(event.target.value)} /></label>
            <button type="button" className="admin-btn admin-btn-secondary" onClick={refreshAnalytics}>Update analytics</button>
          </div>
        </div>
        {analytics && (
          <>
            <div className="class-report-summary">
              <span><strong>{analytics.summary.totalBookings}</strong> registrations</span>
              <span><strong>{analytics.summary.attended}</strong> attended</span>
              <span><strong>{analytics.summary.absent}</strong> absent</span>
              <span><strong>{analytics.summary.pending}</strong> pending</span>
              <span><strong>{analytics.summary.attendanceRate}%</strong> attendance rate</span>
              <span><strong>{analytics.summary.capacityUtilization}%</strong> capacity utilization</span>
            </div>
            <div className="class-analytics-grid">
              <div>
                <h3>Class popularity</h3>
                <table className="class-report-table">
                  <thead><tr><th>Class</th><th>Bookings</th><th>Attended</th></tr></thead>
                  <tbody>
                    {analytics.classes.map((classStats) => (
                      <tr key={classStats.class_id}><td>{classStats.title}</td><td>{classStats.registrations}</td><td>{classStats.attended}</td></tr>
                    ))}
                    {analytics.classes.length === 0 && <tr><td colSpan="3">No class bookings in this period.</td></tr>}
                  </tbody>
                </table>
              </div>
              <div>
                <h3>Daily attendance trend</h3>
                <table className="class-report-table">
                  <thead><tr><th>Date</th><th>Booked</th><th>Present</th><th>Absent</th></tr></thead>
                  <tbody>
                    {analytics.dailyTrends.map((day) => (
                      <tr key={day.date}><td>{day.date}</td><td>{day.registrations}</td><td>{day.attended}</td><td>{day.absent}</td></tr>
                    ))}
                    {analytics.dailyTrends.length === 0 && <tr><td colSpan="4">No attendance activity in this period.</td></tr>}
                  </tbody>
                </table>
              </div>
              <div>
                <h3>Repeated absences</h3>
                <div className="class-repeat-absences">
                  {analytics.repeatAbsences.map((student) => (
                    <p key={student.student_id}>{student.name} · {student.phone} · {student.absence_count} absences</p>
                  ))}
                  {analytics.repeatAbsences.length === 0 && <p>No repeated absences in this period.</p>}
                </div>
              </div>
            </div>
          </>
        )}
      </section>

      <p className="class-access-reminder">Campus access uses the separate daily QR/4-digit verification flow. Campus entry never automatically marks class attendance.</p>
    </div>
  )
}

export default Classes
