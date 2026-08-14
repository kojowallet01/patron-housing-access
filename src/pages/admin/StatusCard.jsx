export default function StatusCard() {
  return (
    <div className="sidebar-card status-widget">
      <div className="sidebar-card-header">
        <h3>System Status</h3>
      </div>
      <div className="status-grid">
        <div className="status-row">
          <span>Entrance QR</span>
          <strong className="status-active">Active</strong>
        </div>
        <div className="status-row">
          <span>Security</span>
          <strong className="status-active">Online</strong>
        </div>
        <div className="status-row">
          <span>Last refresh</span>
          <strong>{new Date().toLocaleTimeString()}</strong>
        </div>
      </div>
    </div>
  )
}
