const reportItems = [
  { title: 'Daily Signups', path: '/reports/daily' },
  { title: 'Weekly Signups', path: '/reports/weekly' },
  { title: 'Monthly Signups', path: '/reports/monthly' }
]

export default function ReportLinks() {
  return (
    <div className="sidebar-card report-widget">
      <div className="sidebar-card-header">
        <h3>Reports</h3>
        <p>Quick access to signup reports</p>
      </div>
      <div className="report-links">
        {reportItems.map((item) => (
          <button
            key={item.path}
            type="button"
            className="report-link-btn"
            onClick={() => {
              window.location.href = item.path
            }}
          >
            {item.title}
          </button>
        ))}
      </div>
    </div>
  )
}
