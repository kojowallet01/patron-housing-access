function calendarDateTime(date, time) {
  return `${date.replace(/-/g, '')}T${time.replace(':', '')}00Z`
}

function escapeCalendarText(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/\r\n?|\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
}

function descriptionFor(booking, instituteName) {
  return [
    instituteName,
    booking.description_snapshot,
    `Instructor: ${booking.instructor_snapshot || 'Not specified'}`,
    'Campus entry is separate. Use the normal entrance QR and daily access-code verification.'
  ].filter(Boolean).join('\n')
}

export function getCalendarLinks(booking, instituteName) {
  const date = booking.class_date_snapshot || booking.class_date
  const start = calendarDateTime(date, booking.start_time_snapshot)
  const end = calendarDateTime(date, booking.end_time_snapshot)
  const description = descriptionFor(booking, instituteName)
  const query = new URLSearchParams({
    text: `${booking.class_title_snapshot} - ${instituteName}`,
    dates: `${start}/${end}`,
    details: description,
    location: booking.classroom_snapshot
  })

  return {
    google: `https://calendar.google.com/calendar/render?action=TEMPLATE&${query.toString()}`,
    outlook: `https://outlook.live.com/calendar/0/deeplink/compose?${new URLSearchParams({
      subject: `${booking.class_title_snapshot} - ${instituteName}`,
      startdt: `${date}T${booking.start_time_snapshot}:00Z`,
      enddt: `${date}T${booking.end_time_snapshot}:00Z`,
      body: description,
      location: booking.classroom_snapshot
    }).toString()}`
  }
}

export function downloadCalendarInvite(booking, instituteName) {
  const date = booking.class_date_snapshot || booking.class_date
  const start = calendarDateTime(date, booking.start_time_snapshot)
  const end = calendarDateTime(date, booking.end_time_snapshot)
  const now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const description = escapeCalendarText(descriptionFor(booking, instituteName))
  const event = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//${escapeCalendarText(instituteName)}//Class Timetable//EN`,
    `X-WR-CALNAME:${escapeCalendarText(instituteName)}`,
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${booking.id}@aifsp`,
    `DTSTAMP:${now}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${escapeCalendarText(booking.class_title_snapshot)}`,
    `DESCRIPTION:${description}`,
    `LOCATION:${escapeCalendarText(booking.classroom_snapshot)}`,
    ...['-P2D', '-P1D', '-PT1H'].flatMap((trigger) => [
      'BEGIN:VALARM',
      `TRIGGER:${trigger}`,
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeCalendarText(`${booking.class_title_snapshot} is coming up.`)}`,
      'END:VALARM'
    ]),
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n')
  const url = URL.createObjectURL(new Blob([event], { type: 'text/calendar;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `${booking.class_title_snapshot.replace(/[^a-z0-9_-]+/gi, '-')}-${date}.ics`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
