function Analytics({ analytics, range, onRangeChange }) {
  if (!analytics) return null

  const maxHour = Math.max(...analytics.peakHours, 1)
  const maxPurpose = Math.max(...analytics.purposes.map(p => p.count), 1)
  const labels = ['12a','1a','2a','3a','4a','5a','6a','7a','8a','9a','10a','11a','12p','1p','2p','3p','4p','5p','6p','7p','8p','9p','10p','11p']

  return (
    <div className="analytics-section">
      <div className="analytics-header">
        <h3>Analytics</h3>
        <select className="analytics-range" value={range} onChange={(e) => onRangeChange(e.target.value)}>
          <option value="day">Today</option>
          <option value="week">This Week</option>
          <option value="month">This Month</option>
        </select>
      </div>

      <div className="analytics-summary">
        <div className="analytics-card">
          <strong>{analytics.totalVisits}</strong>
          <span>Total Visits</span>
        </div>
        <div className="analytics-card">
          <strong>{analytics.uniqueVisitors}</strong>
          <span>Unique Visitors</span>
        </div>
        <div className="analytics-card">
          <strong>{analytics.returningVisitors}</strong>
          <span>Returning</span>
        </div>
        <div className="analytics-card">
          <strong>{analytics.newStudents}</strong>
          <span>New Signups</span>
        </div>
      </div>

      <div className="analytics-charts">
        <div className="chart-card">
          <h4>Visits by Hour</h4>
          <div className="hour-chart">
            {analytics.peakHours.map((count, hour) => (
              <div className="hour-bar-wrap" key={hour} title={`${labels[hour]} — ${count}`}>
                <div className="hour-bar" style={{ height: `${Math.round((count / maxHour) * 100)}%` }} />
                {count > 0 && <span className="hour-count">{count}</span>}
              </div>
            ))}
          </div>
          <div className="hour-labels">
            {[0, 6, 12, 18, 23].map(h => <span key={h}>{labels[h]}</span>)}
          </div>
        </div>

        <div className="chart-card">
          <h4>Visits by Purpose</h4>
          {analytics.purposes.length === 0 ? (
            <div className="no-data">No visits in this period</div>
          ) : (
            <div className="purpose-chart">
              {analytics.purposes.slice(0, 6).map(p => (
                <div className="purpose-row" key={p.purpose}>
                  <span className="purpose-label">{p.purpose}</span>
                  <div className="purpose-bar-track">
                    <div className="purpose-bar" style={{ width: `${Math.round((p.count / maxPurpose) * 100)}%` }} />
                  </div>
                  <span className="purpose-count">{p.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Analytics
