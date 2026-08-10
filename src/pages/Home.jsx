import React from 'react'
import { CAMPUS_INSTITUTE_NAME, CAMPUS_LIST } from '../config'

function Home() {
  const openPage = (url) => {
    window.open(url, '_blank')
  }

  return (
    <div className="fullscreen-container home-page">
      <div className="home-header">
        <h1>🏛️ {CAMPUS_INSTITUTE_NAME}</h1>
        <p>Sub-campus access control panel</p>
      </div>

      <div className="home-content">
        <div className="home-campus-list">
          {CAMPUS_LIST.map((campus) => (
            <div key={campus} className="campus-badge">{campus}</div>
          ))}
        </div>

        <div className="page-grid">
          <div className="page-card entrance-card" onClick={() => window.location.href = '/'}>
            <div className="page-icon">🚪</div>
            <h3>Entrance Display</h3>
            <p>Display QR for the selected campus</p>
            <div className="page-url">localhost:3000/</div>
            <button className="page-btn">Open</button>
          </div>

          <div className="page-card security-card" onClick={() => window.location.href = '/security'}>
            <div className="page-icon">🔒</div>
            <h3>Security Verification</h3>
            <p>Verify access tokens for campus staff</p>
            <div className="page-url">localhost:3000/security</div>
            <button className="page-btn">Open</button>
          </div>

          <div className="page-card admin-card" onClick={() => window.location.href = '/admin'}>
            <div className="page-icon">📊</div>
            <h3>Admin Dashboard</h3>
            <p>Monitor campus visitors and statistics</p>
            <div className="page-url">localhost:3000/admin</div>
            <button className="page-btn">Open</button>
          </div>
        </div>

        <div className="home-info">
          <h3>📱 Campus access flow</h3>
          <ol>
            <li><strong>Entrance Display:</strong> Shows a QR code for the relevant campus</li>
            <li><strong>Students Scan:</strong> Opens the registration form on their phone</li>
            <li><strong>Students Register:</strong> Receive an instant access token</li>
            <li><strong>Security Verifies:</strong> Validates the token for access approval</li>
            <li><strong>Admin Monitors:</strong> Reviews visitor data for each sub-campus</li>
          </ol>
        </div>
      </div>
    </div>
  )
}

export default Home
