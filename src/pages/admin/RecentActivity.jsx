export default function RecentActivity({ activities }) {
  return (
    <div className="sidebar-card activity-widget">
      <div className="sidebar-card-header">
        <h3>Recent Activity</h3>
        <span className="activity-badge">{activities.length}</span>
      </div>
      <div className="activity-feed">
        {activities.length === 0 ? (
          <div className="no-activity">
            <p>No recent entries</p>
            <p className="small-text">Check-ins appear here when visitors sign in.</p>
          </div>
        ) : (
          activities.map((activity, index) => (
            <div key={index} className="activity-item">
              <div className="activity-icon">✓</div>
              <div className="activity-details">
                <div className="activity-name">{activity.name}</div>
                <div className="activity-time">{new Date(activity.timestamp).toLocaleString()}</div>
                <div className="activity-action">{activity.purpose || 'Checked in'}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
