import React from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, CalendarRange, CalendarClock, BarChart3 } from 'lucide-react'
import { useAdminContext } from './AdminLayout'

const REPORTS = [
  {
    to: '/admin/reports/daily',
    title: 'Daily Signups',
    desc: 'See who checked in today, with search, export, and print options',
    icon: CalendarClock,
    tone: 'indigo'
  },
  {
    to: '/admin/reports/weekly',
    title: 'Weekly Signups',
    desc: 'Visitors and new students across the past 7 days',
    icon: CalendarDays,
    tone: 'emerald'
  },
  {
    to: '/admin/reports/monthly',
    title: 'Monthly Signups',
    desc: 'Full month overview of signups, visits, and totals',
    icon: CalendarRange,
    tone: 'amber'
  }
]

function Reports() {
  const { activeCampus } = useAdminContext()

  return (
    <div className="admin-page-container">
      <div className="admin-page-heading">
        <div>
          <h1 className="admin-page-title">Reports</h1>
          <p className="admin-page-subtitle">
            Quick access to signup reports for <strong>{activeCampus}</strong>
          </p>
        </div>
      </div>

      <div className="admin-reports-grid">
        {REPORTS.map((report) => (
          <Link to={report.to} key={report.to} className="admin-card admin-report-card">
            <div className={`admin-report-icon tone-${report.tone}`}>
              <report.icon size={26} strokeWidth={1.75} />
            </div>
            <div>
              <h2>{report.title}</h2>
              <p>{report.desc}</p>
            </div>
            <span className="admin-report-arrow">View report</span>
          </Link>
        ))}
      </div>

      <div className="admin-card admin-reports-note">
        <BarChart3 size={18} strokeWidth={2} className="admin-reports-note-icon" />
        <p>
          Need deeper analytics? Head to the <Link to="/admin/visitors">Visitors</Link> page for visit
          trends, peak hours, and purpose breakdowns.
        </p>
      </div>
    </div>
  )
}

export default Reports
