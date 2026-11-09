import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { API_URL, CAMPUS_INSTITUTE_NAME, DEFAULT_CAMPUS } from '../config'
import { downloadCalendarInvite, getCalendarLinks } from '../calendar'

function formatVisitDate(iso) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) +
    ' • ' + date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

const FEEDBACK_TAGS = [
  'Fast Check-in',
  'Quiet Study',
  'Good Wi-Fi',
  'Clean Space',
  'Need More Seating',
  'AC / Temperature',
  'Helpful Staff'
]

const CLASS_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function accraDateString() {
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
  const today = accraDateString()
  const date = new Date(`${termStart > today ? termStart : today}T00:00:00.000Z`)
  for (let attempt = 0; attempt < 8 && date.toISOString().slice(0, 10) <= termEnd; attempt += 1) {
    if (date.getUTCDay() === dayOfWeek) return date.toISOString().slice(0, 10)
    date.setUTCDate(date.getUTCDate() + 1)
  }
  return ''
}

function RegisterPage() {
  const [mode, setMode] = useState('quick') // 'quick' (returning) or 'new' (first-time)
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    dateOfBirth: '',
    purpose: 'Personal Study',
    purposeOther: ''
  })
  const [quickPhone, setQuickPhone] = useState('')
  const [campusCode, setCampusCode] = useState('')
  const [campusName, setCampusName] = useState(DEFAULT_CAMPUS)
  const [token, setToken] = useState(null)
  const [error, setError] = useState(null)
  const [statusMessage, setStatusMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [classTerm, setClassTerm] = useState(null)
  const [classSchedules, setClassSchedules] = useState([])
  const [classScheduleError, setClassScheduleError] = useState('')
  const [classDates, setClassDates] = useState({})
  const [classAvailability, setClassAvailability] = useState({})
  const [selectedClassBookings, setSelectedClassBookings] = useState({})
  const [classesLoading, setClassesLoading] = useState(false)
  const [selectedClassDay, setSelectedClassDay] = useState(null)

  // Feedback state
  const [feedbackRating, setFeedbackRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [selectedTag, setSelectedTag] = useState('')
  const [feedbackComment, setFeedbackComment] = useState('')
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false)
  const [feedbackLoading, setFeedbackLoading] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const codeParam = params.get('code')
    const campusParam = params.get('campus')

    if (codeParam) {
      setCampusCode(codeParam)
      if (campusParam) {
        setCampusName(decodeURIComponent(campusParam))
      }
      return
    }

    if (campusParam) {
      setCampusName(decodeURIComponent(campusParam))
      fetch(`${API_URL}/campus-qr?campus=${encodeURIComponent(decodeURIComponent(campusParam))}`)
        .then((response) => {
          if (!response.ok) {
            throw new Error('Failed to resolve campus code')
          }
          return response.json()
        })
        .then((data) => {
          if (data?.code) {
            setCampusCode(data.code)
          } else {
            setError('Invalid registration link. Please scan the QR code at the entrance.')
          }
        })
        .catch(() => {
          setError('Invalid registration link. Please scan the QR code at the entrance.')
        })
      return
    }

    setError('Invalid registration link. Please scan the QR code at the entrance.')
  }, [])

  useEffect(() => {
    let active = true
    setClassesLoading(true)
    fetch(`${API_URL}/classes?campus=${encodeURIComponent(campusName)}`)
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Unable to load available classes.')
        if (!active) return
        const schedules = data.classes || []
        setClassTerm(data.term || null)
        setClassSchedules(schedules)
        setClassScheduleError('')
        setSelectedClassDay((current) => {
          if (current !== null && schedules.some((schedule) => schedule.day_of_week === current)) {
            return current
          }
          return schedules
            .map((schedule) => ({
              day: schedule.day_of_week,
              date: data.term
                ? nextClassDate(schedule.day_of_week, data.term.start_date, data.term.end_date)
                : ''
            }))
            .filter(({ date }) => date)
            .sort((a, b) => a.date.localeCompare(b.date))[0]?.day ?? schedules[0]?.day_of_week ?? null
        })
        const availableIds = new Set(schedules.map((classSchedule) => classSchedule.id))
        setSelectedClassBookings((current) => Object.fromEntries(
          Object.entries(current).filter(([classId, selected]) => availableIds.has(classId) && selected)
        ))
        setClassDates((current) => Object.fromEntries(schedules.map((classSchedule) => [
          classSchedule.id,
          current[classSchedule.id] || (data.term
            ? nextClassDate(classSchedule.day_of_week, data.term.start_date, data.term.end_date)
            : '')
        ])))
      })
      .catch((loadError) => {
        if (active) {
          setClassScheduleError(loadError.message)
          setError(loadError.message)
        }
      })
      .finally(() => {
        if (active) setClassesLoading(false)
      })
    return () => { active = false }
  }, [campusName])

  useEffect(() => {
    let active = true
    classSchedules
      .filter((classSchedule) =>
        classSchedule.day_of_week === selectedClassDay || selectedClassBookings[classSchedule.id]
      )
      .forEach(async (classSchedule) => {
      const classDate = classDates[classSchedule.id]
      if (!classDate) return
      const query = new URLSearchParams({
        campus: campusName,
        class_id: classSchedule.id,
        date: classDate
      })
      try {
        const response = await fetch(`${API_URL}/classes/availability?${query}`)
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Unable to check class availability.')
        if (active) setClassAvailability((current) => ({ ...current, [`${classSchedule.id}:${classDate}`]: data }))
      } catch (availabilityError) {
        if (active) setClassAvailability((current) => ({
          ...current,
          [`${classSchedule.id}:${classDate}`]: { available: false, reason: availabilityError.message }
        }))
      }
    })
    return () => { active = false }
  }, [campusName, classDates, classSchedules, selectedClassBookings, selectedClassDay])

  const requestToken = async (phone) => {
    const response = await fetch(`${API_URL}/generate-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: phone.trim(),
        campusCode,
        code: campusCode,
        campus: campusName
      })
    })

    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.error || 'Failed to generate token')
    }

    return data
  }

  // Handle Quick Check-In for returning members
  const handleQuickSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setStatusMessage('')
    setLoading(true)

    const phone = quickPhone.trim()
    if (!phone) {
      setError('Please enter your phone number.')
      setLoading(false)
      return
    }

    if (!campusCode) {
      setError('Invalid registration link. Please scan the QR code at the entrance.')
      setLoading(false)
      return
    }

    try {
      const tokenData = await requestToken(phone)
      setToken({ ...tokenData, returning: true })
    } catch (err) {
      if (err.message?.toLowerCase().includes('not found') || err.message?.toLowerCase().includes('not registered')) {
        setError(`Phone number ${phone} is not registered yet. Switch to First-Time Visitor below to register in 30 seconds.`)
        setFormData((prev) => ({ ...prev, phone }))
      } else {
        setError(err.message || 'Unable to retrieve access code. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  // Handle first-time registration
  const handleNewSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setStatusMessage('')
    setLoading(true)

    try {
      const name = formData.name.trim()
      const phone = formData.phone.trim()
      const dateOfBirth = formData.dateOfBirth
      const purpose = formData.purpose === 'Other'
        ? formData.purposeOther.trim()
        : formData.purpose

      if (!campusCode) {
        setError('Invalid registration link. Please scan the QR code at the entrance.')
        setLoading(false)
        return
      }

      if (!name || !phone || !formData.purpose) {
        const missingFields = []
        if (!name) missingFields.push('Name')
        if (!phone) missingFields.push('Phone')
        if (!formData.purpose) missingFields.push('Purpose')
        setError(`Please fill in: ${missingFields.join(', ')}`)
        setLoading(false)
        return
      }

      if (!dateOfBirth || dateOfBirth > accraDateString()) {
        setError('Enter a valid date of birth that is not in the future.')
        setLoading(false)
        return
      }

      if (formData.purpose === 'Other' && !formData.purposeOther.trim()) {
        setError('Please specify the purpose of your visit.')
        setLoading(false)
        return
      }

      const classBookings = Object.entries(selectedClassBookings)
        .filter(([, selected]) => selected)
        .map(([classId]) => ({ classId, classDate: classDates[classId] }))
      if (!classBookings.length) {
        setError('Select at least one class session to complete registration.')
        setLoading(false)
        return
      }
      if (classBookings.some((booking) => !booking.classDate)) {
        setError('Choose a valid date for every selected class.')
        setLoading(false)
        return
      }
      const unavailable = classBookings.find((booking) =>
        classAvailability[`${booking.classId}:${booking.classDate}`]?.available !== true
      )
      if (unavailable) {
        const status = classAvailability[`${unavailable.classId}:${unavailable.classDate}`]
        setError(status?.reason || 'Wait for the selected class availability to load, then try again.')
        setLoading(false)
        return
      }

      const registerResponse = await fetch(`${API_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          phone,
          date_of_birth: dateOfBirth,
          purpose,
          campus: campusName,
          classBookings
        })
      })

      const registerData = await registerResponse.json()

      let tokenData
      let returning = false
      if (registerResponse.ok) {
        tokenData = await requestToken(phone)
      } else if (registerData.error?.includes('already registered')) {
        returning = true
        setStatusMessage('Account recognized. Your class selections were not changed; use the class timetable to manage bookings.')
        tokenData = await requestToken(phone)
      } else {
        setError(registerData.error || 'Registration failed')
        setLoading(false)
        return
      }

      setToken({ ...tokenData, returning, classBookings: registerData.bookings || [] })
    } catch (err) {
      setError(err.message || 'Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleCopyToken = async () => {
    if (!token?.token) return
    try {
      await navigator.clipboard.writeText(token.token)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Unable to copy token', err)
    }
  }

  const handleFeedbackSubmit = async (e) => {
    e.preventDefault()
    if (!feedbackRating) return
    setFeedbackLoading(true)
    try {
      await fetch(`${API_URL}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: token?.student?.phone,
          studentId: token?.student?.id,
          campus: token?.campus || campusName,
          rating: feedbackRating,
          category: selectedTag || 'General',
          comment: feedbackComment.trim() || undefined
        })
      })
      setFeedbackSubmitted(true)
    } catch (err) {
      console.error('Feedback submit failed:', err)
    } finally {
      setFeedbackLoading(false)
    }
  }

  const goBackHome = () => {
    window.location.href = '/'
  }
  const recordCalendarSelection = async (booking) => {
    const response = await fetch(`${API_URL}/classes/bookings/${booking.id}/calendar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: token?.student?.name || formData.name,
        phone: token?.student?.phone || formData.phone,
        campus: token?.campus || campusName
      })
    })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || 'Unable to record the calendar selection.')
  }
  const openCalendarLink = async (event, booking, url) => {
    event.preventDefault()
    const popup = window.open('about:blank', '_blank')
    if (popup) popup.opener = null
    try {
      await recordCalendarSelection(booking)
      setStatusMessage('Calendar option selected. Reminder delivery depends on your calendar app.')
      if (popup) popup.location.href = url
      else window.location.assign(url)
    } catch (calendarError) {
      popup?.close()
      setError(calendarError.message)
    }
  }
  const addBookingToCalendar = async (booking) => {
    try {
      await recordCalendarSelection(booking)
      downloadCalendarInvite(booking, CAMPUS_INSTITUTE_NAME)
      setStatusMessage('Calendar option selected. Reminder delivery depends on your calendar app.')
    } catch (calendarError) {
      setError(calendarError.message)
    }
  }
  const earliestClassDate = classTerm
    ? (classTerm.start_date > accraDateString() ? classTerm.start_date : accraDateString())
    : accraDateString()

  if (token) {
    return (
      <div className="mobile-container">
        <div className="mobile-header">
          <img src="/logo.png" alt="AIFSP" className="mobile-logo" />
          <h1>{CAMPUS_INSTITUTE_NAME}</h1>
        </div>

        <div className="token-success">
          <div className="success-icon">✅</div>

          {token.milestone && (
            <div className={`milestone-badge milestone-${token.milestone.tier}`}>
              <span className="milestone-badge-icon">
                {token.milestone.tier === 'gold' ? '👑' : token.milestone.tier === 'silver' ? '🎖️' : token.milestone.tier === 'bronze' ? '🌟' : '🎉'}
              </span>
              <span className="milestone-badge-text">{token.milestone.badge}</span>
            </div>
          )}

          <h2>{token.returning ? 'Access Granted!' : 'Registration Complete!'}</h2>
          <p className="welcome-text">
            {token.returning ? 'Welcome back, ' : 'Welcome, '}<strong>{token.student?.name}</strong>
          </p>
          <p className="subtitle">{token.campus || campusName}</p>

          <div className="token-qr-box">
            <h3>Your Access Token</h3>
            <img
              src={token.tokenQR}
              alt="Access Token"
              className="token-qr"
            />
          </div>

          <div className="token-alert">
            📱 <strong>Show this QR code or 4-digit code to security at the entrance.</strong>
          </div>

          {statusMessage && <div className="alert alert-success">{statusMessage}</div>}
          {error && <div className="alert alert-error" role="alert">{error}</div>}

          <div className="token-details">
            <p><strong>Token Code</strong></p>
            <p className="token-id">{token.token}</p>
            <p className="valid-date">Valid for today: {new Date().toLocaleDateString()}</p>
          </div>

          {token.classBookings?.length > 0 && (
            <section className="registration-class-confirmation">
              <h3>Class registration successful</h3>
              <p>Your class booking is separate from this daily campus access code.</p>
              {token.classBookings.map((booking) => (
                <article className="registration-class-confirmation-item" key={booking.id}>
                  <strong>{booking.class_title_snapshot}</strong>
                  <span>{booking.class_date} · {booking.start_time_snapshot}–{booking.end_time_snapshot} · {booking.classroom_snapshot}</span>
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
                    <button type="button" className="admin-btn admin-btn-secondary" onClick={() => addBookingToCalendar(booking)}>
                      Download ICS reminders
                    </button>
                  </div>
                </article>
              ))}
            </section>
          )}

          {/* Patron Facility Experience Feedback Form */}
          <div className="feedback-card">
            <h3>⭐ How was your visit today?</h3>
            <p className="feedback-subtitle">Help us improve your campus experience</p>

            {feedbackSubmitted ? (
              <div className="feedback-thankyou">
                <span className="thankyou-icon">🌟</span>
                <p>Thank you for your feedback! It helps us keep our facility running at its best.</p>
              </div>
            ) : (
              <form onSubmit={handleFeedbackSubmit} className="feedback-form">
                <div className="star-row">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      className={`star-btn ${star <= (hoverRating || feedbackRating) ? 'active' : ''}`}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      onClick={() => setFeedbackRating(star)}
                      aria-label={`${star} star`}
                    >
                      ★
                    </button>
                  ))}
                </div>

                {feedbackRating > 0 && (
                  <>
                    <div className="feedback-chips">
                      {FEEDBACK_TAGS.map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          className={`feedback-chip ${selectedTag === tag ? 'active' : ''}`}
                          onClick={() => setSelectedTag(selectedTag === tag ? '' : tag)}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>

                    <textarea
                      className="feedback-input"
                      rows="2"
                      placeholder="Any notes or suggestions? (Optional)"
                      value={feedbackComment}
                      onChange={(e) => setFeedbackComment(e.target.value)}
                      maxLength="300"
                    />

                    <button
                      type="submit"
                      className="btn btn-secondary btn-sm"
                      disabled={feedbackLoading}
                    >
                      {feedbackLoading ? 'Submitting...' : 'Submit Rating'}
                    </button>
                  </>
                )}
              </form>
            )}
          </div>

          {Array.isArray(token.recentVisits) && token.recentVisits.length > 0 && (
            <div className="visit-history">
              <h3>Your Recent Entries</h3>
              <ul className="visit-list">
                {token.recentVisits.map((visit) => (
                  <li key={visit.id} className="visit-item">
                    <span className="visit-dot" aria-hidden="true" />
                    <span className="visit-when">{formatVisitDate(visit.used_at)}</span>
                    <span className="visit-campus">{visit.campus}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="token-actions">
            <button className="btn btn-secondary" onClick={handleCopyToken}>
              {copied ? 'Copied!' : 'Copy 4-Digit Code'}
            </button>
            <button className="btn btn-primary" onClick={goBackHome}>
              Done / Back
            </button>
          </div>

          <Link className="class-registration-link" to="/classes">
            Manage your class bookings
          </Link>

          <div className="token-tip">
            💡 Tip: Keep this page open or take a screenshot for faster checkpoint scanning.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mobile-container">
      <div className="mobile-header">
        <img src="/logo.png" alt="AIFSP" className="mobile-logo" />
        <h1>{CAMPUS_INSTITUTE_NAME}</h1>
        <p>{campusName} • Facility Access</p>
      </div>

      <div className="mobile-content">
        {/* Tab switcher for frictionless returning check-ins */}
        <div className="entry-mode-switch">
          <button
            type="button"
            className={`entry-mode-tab ${mode === 'quick' ? 'active' : ''}`}
            onClick={() => { setMode('quick'); setError(null); }}
          >
            ⚡ Quick Pass (Returning)
          </button>
          <button
            type="button"
            className={`entry-mode-tab ${mode === 'new' ? 'active' : ''}`}
            onClick={() => { setMode('new'); setError(null); }}
          >
            📝 First-Time Visitor
          </button>
        </div>

        {statusMessage && (
          <div className="alert alert-success">
            {statusMessage}
          </div>
        )}

        {error && (
          <div className="alert alert-error">
            <p>{error}</p>
            {mode === 'quick' && error.includes('not registered') && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                style={{ marginTop: '8px' }}
                onClick={() => {
                  setMode('new');
                  setFormData((prev) => ({ ...prev, phone: quickPhone.trim() }));
                  setError(null);
                }}
              >
                Register Here
              </button>
            )}
          </div>
        )}

        {mode === 'quick' ? (
          /* QUICK PASS FOR RETURNING PATRONS */
          <form onSubmit={handleQuickSubmit} className="mobile-form">
            <div className="quick-pass-banner">
              <h3>⚡ Rapid Entrance</h3>
              <p>Enter your phone number to receive your authorized access code instantly.</p>
            </div>

            <div className="form-group">
              <label htmlFor="quick-phone">Your Registered Phone Number *</label>
              <input
                id="quick-phone"
                type="tel"
                value={quickPhone}
                onChange={(e) => setQuickPhone(e.target.value)}
                placeholder="e.g. 024 123 4567"
                autoFocus
                required
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-large"
              disabled={loading || !campusCode}
            >
              {loading ? 'Checking in...' : '⚡ Get My Access Pass'}
            </button>

            <div className="quick-switch-hint">
              First time visiting {campusName}?{' '}
              <button
                type="button"
                className="link-btn"
                onClick={() => { setMode('new'); setError(null); }}
              >
                Register as a new visitor
              </button>
            </div>
          </form>
        ) : (
          /* FIRST-TIME VISITOR REGISTRATION */
          <form onSubmit={handleNewSubmit} className="mobile-form">
            <div className="form-group class-registration-picker">
              <label>1. Choose your class session *</label>
              <p className="field-description">
                Pick a day to see its classes. This books a class only; campus entry still requires the normal daily access code and verification.
              </p>
              {classesLoading ? (
                <p className="class-empty-state">Loading the active class timetable…</p>
              ) : classScheduleError ? (
                <p className="class-empty-state">
                  Class registration is temporarily unavailable. The timetable database migration may need to be applied. Please contact an administrator.
                </p>
              ) : !classTerm ? (
                <p className="class-empty-state">No active academic term is available for this campus. An administrator must activate a term before registration can continue.</p>
              ) : classSchedules.length === 0 ? (
                <p className="class-empty-state">There are no published classes available for registration.</p>
              ) : (
                <>
                  <div className="class-registration-day-tabs" aria-label="Filter classes by day">
                    {[...new Set(classSchedules.map((schedule) => schedule.day_of_week))]
                      .sort((a, b) => a - b)
                      .map((day) => (
                        <button
                          key={day}
                          type="button"
                          className={`class-registration-day-tab ${selectedClassDay === day ? 'active' : ''}`}
                          aria-pressed={selectedClassDay === day}
                          onClick={() => setSelectedClassDay(day)}
                        >
                          {CLASS_DAYS[day].slice(0, 3)}
                          <span>{classSchedules.filter((schedule) => schedule.day_of_week === day).length}</span>
                        </button>
                      ))}
                  </div>
                  <p className="class-registration-selection-count" aria-live="polite">
                    {Object.values(selectedClassBookings).filter(Boolean).length
                      ? `${Object.values(selectedClassBookings).filter(Boolean).length} class session${Object.values(selectedClassBookings).filter(Boolean).length === 1 ? '' : 's'} selected`
                      : 'Select at least one class to continue'}
                  </p>
                  {Object.entries(selectedClassBookings)
                    .filter(([, selected]) => selected)
                    .map(([classId]) => {
                      const schedule = classSchedules.find((item) => item.id === classId)
                      if (!schedule) return null
                      return (
                        <div className="class-registration-selected-item" key={classId}>
                          {schedule.title} · {CLASS_DAYS[schedule.day_of_week]} · {classDates[classId]}
                        </div>
                      )
                    })}
                  <div className="class-registration-options">
                    {classSchedules
                      .filter((schedule) => schedule.day_of_week === selectedClassDay)
                      .map((classSchedule) => {
                        const availability = classAvailability[`${classSchedule.id}:${classDates[classSchedule.id]}`]
                        return (
                          <div
                            className={`class-registration-option ${selectedClassBookings[classSchedule.id] ? 'selected' : ''}`}
                            key={classSchedule.id}
                          >
                            <label className="class-registration-choice">
                              <input
                                type="checkbox"
                                checked={Boolean(selectedClassBookings[classSchedule.id])}
                                onChange={(event) => setSelectedClassBookings((current) => ({
                                  ...current,
                                  [classSchedule.id]: event.target.checked
                                }))}
                              />
                              <span>
                                <strong>{classSchedule.title}</strong>
                                <small>
                                  {classSchedule.start_time}–{classSchedule.end_time} · {classSchedule.classroom}
                                </small>
                                {classSchedule.instructor && <small>Instructor: {classSchedule.instructor}</small>}
                              </span>
                            </label>
                            <small className={!availability
                              ? 'class-availability-pending'
                              : availability.available ? 'class-availability-open' : 'class-availability-closed'}>
                              {availability
                                ? availability.available
                                  ? `${availability.remainingCapacity} seat${availability.remainingCapacity === 1 ? '' : 's'} available`
                                  : availability.reason
                                : 'Checking availability…'}
                            </small>
                            {selectedClassBookings[classSchedule.id] && (
                              <label className="class-registration-date">
                                Class date
                                <input
                                  type="date"
                                  min={earliestClassDate}
                                  max={classTerm.end_date}
                                  value={classDates[classSchedule.id] || ''}
                                  required
                                  onChange={(event) => setClassDates((current) => ({
                                    ...current,
                                    [classSchedule.id]: event.target.value
                                  }))}
                                />
                              </label>
                            )}
                          </div>
                        )
                      })}
                  </div>
                </>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="reg-dob">2. Date of birth *</label>
              <p className="field-description">Enter your date of birth to complete registration.</p>
              <input
                id="reg-dob"
                type="date"
                name="dateOfBirth"
                value={formData.dateOfBirth}
                max={accraDateString()}
                onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="reg-name">3. Full Name *</label>
              <p className="field-description">Identifies everyone using the facility and ensures safety.</p>
              <input
                id="reg-name"
                type="text"
                name="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                placeholder="e.g. Kwesi Mensah"
              />
            </div>

            <div className="form-group">
              <label htmlFor="reg-phone">4. Phone Number *</label>
              <p className="field-description">Used for quick return passes and facility notifications.</p>
              <input
                id="reg-phone"
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                required
                placeholder="e.g. 024 123 4567"
              />
            </div>

            <div className="form-group">
              <label>5. Purpose of Your Visit *</label>
              <p className="field-description">Helps us maintain ideal room capacity and services.</p>

              <div className="radio-group">
                {[
                  'Personal Study',
                  'Institute Class',
                  'Group Meeting',
                  'Office / Administrative',
                  'Other'
                ].map((option) => (
                  <label key={option} className="radio-option">
                    <input
                      type="radio"
                      name="purpose"
                      value={option}
                      checked={formData.purpose === option}
                      onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                    />
                    <span>{option === 'Other' ? 'Other (please specify)' : option}</span>
                  </label>
                ))}

                {formData.purpose === 'Other' && (
                  <input
                    type="text"
                    name="purposeOther"
                    value={formData.purposeOther}
                    onChange={(e) => setFormData({ ...formData, purposeOther: e.target.value })}
                    placeholder="Please specify your purpose"
                    className="other-input"
                    required
                  />
                )}
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-large"
              disabled={loading || classesLoading || !campusCode || classSchedules.length === 0 ||
                !Object.values(selectedClassBookings).some(Boolean) ||
                Object.entries(selectedClassBookings).some(([classId, selected]) => selected &&
                  classAvailability[`${classId}:${classDates[classId]}`]?.available !== true)}
            >
              {loading ? 'Registering...' : 'Register, Book Class & Get Pass'}
            </button>

            <div className="quick-switch-hint">
              Already registered before?{' '}
              <button
                type="button"
                className="link-btn"
                onClick={() => { setMode('quick'); setError(null); }}
              >
                Use Quick Pass
              </button>
            </div>
          </form>
        )}

        {!campusCode && (
          <div className="alert alert-error" style={{ marginTop: '20px' }}>
            Invalid registration link. Please scan the QR code displayed at the facility entrance.
          </div>
        )}
      </div>
    </div>
  )
}

export default RegisterPage
