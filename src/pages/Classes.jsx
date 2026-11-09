import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, BookOpen, CalendarDays, Clock3, MapPin, RefreshCw, UserRound } from 'lucide-react'
import { API_URL, CAMPUS_INSTITUTE_NAME, CAMPUS_LIST, getSelectedCampus } from '../config'
import { downloadCalendarInvite, getCalendarLinks } from '../calendar'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function currentAccraDate() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Accra',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
  return `${values.year}-${values.month}-${values.day}`
}

function nextClassDate(dayOfWeek, termStart, termEnd) {
  const today = currentAccraDate()
  let date = new Date(`${termStart > today ? termStart : today}T00:00:00.000Z`)
  for (let attempt = 0; attempt < 8 && date.toISOString().slice(0, 10) <= termEnd; attempt += 1) {
    if (date.getUTCDay() === dayOfWeek) return date.toISOString().slice(0, 10)
    date.setUTCDate(date.getUTCDate() + 1)
  }
  return ''
}

function displayDate(value) {
  return new Date(`${value}T12:00:00.000Z`).toLocaleDateString('en-GH', {
    dateStyle: 'full',
    timeZone: 'Africa/Accra'
  })
}

function Classes() {
  const selectedCampus = getSelectedCampus()
  const [campus, setCampus] = useState(CAMPUS_LIST.includes(selectedCampus) ? selectedCampus : CAMPUS_LIST[0])
  const [term, setTerm] = useState(null)
  const [classes, setClasses] = useState([])
  const [dates, setDates] = useState({})
  const [availability, setAvailability] = useState({})
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [bookings, setBookings] = useState([])
  const [bookingLookupDone, setBookingLookupDone] = useState(false)
  const [loading, setLoading] = useState(true)
  const [timetableUnavailable, setTimetableUnavailable] = useState(false)
  const [submittingClass, setSubmittingClass] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const loadTimetable = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(`${API_URL}/classes?campus=${encodeURIComponent(campus)}`)
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Unable to load the timetable.')
      setTimetableUnavailable(false)
      setTerm(result.term)
      setClasses(result.classes || [])
      if (result.term) {
        setDates((current) => {
          const next = { ...current }
          for (const classSchedule of result.classes || []) {
            if (!next[classSchedule.id]) {
              next[classSchedule.id] = nextClassDate(classSchedule.day_of_week, result.term.start_date, result.term.end_date)
            }
          }
          return next
        })
      }
    } catch (loadError) {
      setTimetableUnavailable(true)
      setError(loadError.message)
    } finally {
      setLoading(false)
    }
  }, [campus])

  useEffect(() => {
    loadTimetable()
  }, [loadTimetable])

  useEffect(() => {
    let active = true
    classes.forEach(async (classSchedule) => {
      const classDate = dates[classSchedule.id]
      if (!classDate) return
      const query = new URLSearchParams({
        campus,
        class_id: classSchedule.id,
        date: classDate
      })
      try {
        const response = await fetch(`${API_URL}/classes/availability?${query}`)
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || 'Unable to check availability.')
        if (active) setAvailability((current) => ({ ...current, [`${classSchedule.id}:${classDate}`]: result }))
      } catch (availabilityError) {
        if (active) setAvailability((current) => ({
          ...current,
          [`${classSchedule.id}:${classDate}`]: { available: false, reason: availabilityError.message }
        }))
      }
    })
    return () => { active = false }
  }, [campus, classes, dates])

  const loadBookings = async (event) => {
    event?.preventDefault()
    setError('')
    if (!name.trim() || !phone.trim()) {
      setError('Enter the name and phone number used for campus registration.')
      return
    }
    try {
      const params = new URLSearchParams({ name: name.trim(), phone: phone.trim(), campus })
      const response = await fetch(`${API_URL}/classes/bookings?${params}`)
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Unable to load bookings.')
      setBookings(result.bookings || [])
      setBookingLookupDone(true)
    } catch (loadError) {
      setError(loadError.message)
      setBookings([])
      setBookingLookupDone(false)
    }
  }

  const bookClass = async (classSchedule) => {
    setError('')
    setMessage('')
    if (!name.trim() || !phone.trim()) {
      setError('Enter your campus-registered name and phone number before booking.')
      return
    }
    setSubmittingClass(classSchedule.id)
    try {
      const response = await fetch(`${API_URL}/classes/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classId: classSchedule.id,
          classDate: dates[classSchedule.id],
          name: name.trim(),
          phone: phone.trim(),
          campus
        })
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Unable to book this class.')
      setMessage(`Booked ${classSchedule.title} for ${displayDate(result.booking.class_date)}. This booking does not grant campus access.`)
      await loadBookings()
    } catch (bookingError) {
      setError(bookingError.message)
    } finally {
      setSubmittingClass('')
    }
  }

  const cancelBooking = async (bookingId) => {
    setError('')
    setMessage('')
    try {
      const response = await fetch(`${API_URL}/classes/bookings/${bookingId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim(), campus })
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Unable to cancel this booking.')
      setMessage(result.message)
      await loadBookings()
    } catch (cancelError) {
      setError(cancelError.message)
    }
  }

  const recordCalendarSelection = async (booking) => {
    const response = await fetch(`${API_URL}/classes/bookings/${booking.id}/calendar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), phone: phone.trim(), campus })
    })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || 'Unable to record the calendar selection.')
    await loadBookings()
  }

  const openCalendarLink = async (event, booking, url) => {
    event.preventDefault()
    const popup = window.open('about:blank', '_blank')
    if (popup) popup.opener = null
    setError('')
    try {
      await recordCalendarSelection(booking)
      setMessage('Calendar option selected. Reminder delivery depends on your calendar app.')
      if (popup) popup.location.href = url
      else window.location.assign(url)
    } catch (calendarError) {
      popup?.close()
      setError(calendarError.message)
    }
  }

  const downloadCalendar = async (booking) => {
    setError('')
    try {
      await recordCalendarSelection(booking)
      downloadCalendarInvite(booking, CAMPUS_INSTITUTE_NAME)
    } catch (calendarError) {
      setError(calendarError.message)
    }
  }

  const statusLabel = (booking) => {
    if (booking.status === 'booked') return booking.attendance?.status || 'Booked — attendance pending'
    if (booking.status === 'schedule_changed') return 'Schedule changed — please rebook'
    if (booking.status === 'class_cancelled') return 'Class cancelled'
    return 'Cancelled'
  }

  const selectedAvailability = (classSchedule) => availability[`${classSchedule.id}:${dates[classSchedule.id]}`]

  return (
    <main className="class-student-page">
      <header className="class-student-header">
        <Link to="/" className="class-back-link"><ArrowLeft size={17} /> Campus access</Link>
        <div>
          <p className="class-eyebrow">AIFSP Student Portal</p>
          <h1>Class timetable & bookings</h1>
          <p>Book a class separately from your daily campus access check-in.</p>
        </div>
      </header>

      <section className="class-student-panel">
        <div className="class-panel-heading">
          <div>
            <h2><BookOpen size={19} /> Find a class</h2>
            {term && <p>{term.name} · {displayDate(term.start_date)} – {displayDate(term.end_date)}</p>}
          </div>
          <button type="button" className="admin-btn admin-btn-secondary" onClick={loadTimetable} disabled={loading}>
            <RefreshCw size={15} /> Refresh
          </button>
        </div>

        <form className="class-student-identity" onSubmit={loadBookings}>
          <label>
            Campus
            <select value={campus} onChange={(event) => { setCampus(event.target.value); setBookings([]); setBookingLookupDone(false); }}>
              {CAMPUS_LIST.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label>
            Registered full name
            <input value={name} onChange={(event) => { setName(event.target.value); setBookingLookupDone(false); }} autoComplete="name" />
          </label>
          <label>
            Registered phone
            <input type="tel" value={phone} onChange={(event) => { setPhone(event.target.value); setBookingLookupDone(false); }} autoComplete="tel" />
          </label>
          <button type="submit" className="admin-btn admin-btn-secondary">
            View my bookings
          </button>
        </form>

        {message && <div className="class-notice class-notice-success" role="status">{message}</div>}
        {error && <div className="class-notice class-notice-error" role="alert">{error}</div>}

        {loading ? (
          <p className="class-empty-state">Loading timetable…</p>
        ) : timetableUnavailable ? (
          <p className="class-empty-state">
            Class registration is temporarily unavailable. The timetable database migration may need to be applied. Please contact an administrator.
          </p>
        ) : !term ? (
          <p className="class-empty-state">There is no active academic term for this campus yet. An administrator must activate a term before classes can be booked.</p>
        ) : classes.length === 0 ? (
          <p className="class-empty-state">No classes are currently open for registration.</p>
        ) : (
          <div className="class-student-list">
            {classes.map((classSchedule) => (
              <article className="class-student-card" key={classSchedule.id}>
                <div className="class-student-card-copy">
                  <span className="class-status-pill">Registration open</span>
                  <h3>{classSchedule.title}</h3>
                  {classSchedule.description && <p>{classSchedule.description}</p>}
                  <div className="class-meta-row">
                    <span><CalendarDays size={15} /> Every {DAY_NAMES[classSchedule.day_of_week]}</span>
                    <span><Clock3 size={15} /> {classSchedule.start_time}–{classSchedule.end_time}</span>
                    <span><MapPin size={15} /> {classSchedule.classroom}</span>
                  </div>
                  {classSchedule.instructor && <span className="class-instructor"><UserRound size={14} /> {classSchedule.instructor}</span>}
                </div>
                <div className="class-booking-action">
                  <label>
                    Class date
                    <input
                      type="date"
                      min={term.start_date > currentAccraDate() ? term.start_date : currentAccraDate()}
                      max={term.end_date}
                      value={dates[classSchedule.id] || ''}
                      onChange={(event) => setDates((current) => ({ ...current, [classSchedule.id]: event.target.value }))}
                    />
                  </label>
                  {selectedAvailability(classSchedule) && (
                    <small className={selectedAvailability(classSchedule).available ? 'class-availability-open' : 'class-availability-closed'}>
                      {selectedAvailability(classSchedule).available
                        ? `${selectedAvailability(classSchedule).remainingCapacity} seat${selectedAvailability(classSchedule).remainingCapacity === 1 ? '' : 's'} available`
                        : selectedAvailability(classSchedule).reason}
                    </small>
                  )}
                  <button
                    type="button"
                    className="admin-btn admin-btn-primary"
                    onClick={() => bookClass(classSchedule)}
                    disabled={submittingClass === classSchedule.id || !dates[classSchedule.id] ||
                      selectedAvailability(classSchedule)?.available !== true}
                  >
                    {submittingClass === classSchedule.id ? 'Booking…' : 'Book class'}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {bookingLookupDone && bookings.length === 0 && (
        <section className="class-student-panel"><p className="class-empty-state">No class bookings found for this name, phone number, and campus.</p></section>
      )}

      {bookingLookupDone && bookings.length > 0 && (
        <section className="class-student-panel">
          <div className="class-panel-heading">
            <div>
              <h2><CalendarDays size={19} /> My class bookings</h2>
              <p>Choose Google Calendar, Outlook, or an ICS invite with 2-day, 1-day, and 1-hour reminders where supported. Class check-in is separate from campus entry.</p>
            </div>
          </div>
          <div className="class-booking-list">
            {bookings.map((booking) => (
              <article className="class-booking-row" key={booking.id}>
                <div>
                  <h3>{booking.class_title_snapshot}</h3>
                  <p>{displayDate(booking.class_date)} · {booking.start_time_snapshot}–{booking.end_time_snapshot} · {booking.classroom_snapshot}</p>
                  <span>{statusLabel(booking)}</span>
                  {booking.calendar_added_at && <small>Calendar option selected</small>}
                  {(booking.notifications || []).map((notice) => (
                    <small key={notice.id}>
                      {notice.status === 'accepted' ? 'Update SMS accepted by provider' : notice.status === 'skipped' ? 'Update appears here; SMS was not sent' : 'Update SMS failed'}
                    </small>
                  ))}
                </div>
                {booking.status === 'booked' && (
                  <div className="class-booking-buttons">
                    {Object.entries(getCalendarLinks(booking, CAMPUS_INSTITUTE_NAME)).map(([provider, url]) => (
                      <a
                        key={provider}
                        className="admin-btn admin-btn-secondary"
                        href={url}
                        onClick={(event) => openCalendarLink(event, booking, url)}
                      >
                        Add to {provider === 'google' ? 'Google Calendar' : 'Outlook'}
                      </a>
                    ))}
                    <button type="button" className="admin-btn admin-btn-secondary" onClick={() => downloadCalendar(booking)}>
                      Download ICS
                    </button>
                    <button type="button" className="admin-btn admin-btn-secondary" onClick={() => cancelBooking(booking.id)}>
                      Cancel booking
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>
      )}

      <p className="class-access-reminder">
        A class booking never grants campus entry. On the class day, use the normal entrance QR and daily 4-digit access-code process.
      </p>
    </main>
  )
}

export default Classes
