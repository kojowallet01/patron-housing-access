import React from 'react'

function Home() {
  const openPage = (url) => {
    window.open(url, '_blank')
  }

  return (
    <div className="fullscreen-container home-page">
      <div className="home-header">
        <h1>🏛️ Tesano Campus Institute</h1>
        <p>Sign-In System Control Panel</p>
      </div>

      <div className="home-content">
        <div className="page-grid">
          <div className="page-card entrance-card" onClick={() => window.location.href = '/'}>
            <div className="page-icon">🚪</div>
            <h3>Entrance Display</h3>
            <p>Display QR code at campus entrance</p>
            <div className="page-url">localhost:3000/</div>
            <button className="page-btn">Open</button>
          </div>

          <div className="page-card security-card" onClick={() => window.location.href = '/security'}>
            <div className="page-icon">🔒</div>
            <h3>Security Verification</h3>
            <p>Verify student access tokens</p>
            <div className="page-url">localhost:3000/security</div>
            <button className="page-btn">Open</button>
          </div>

          <div className="page-card admin-card" onClick={() => window.location.href = '/admin'}>
            <div className="page-icon">📊</div>
            <h3>Admin Dashboard</h3>
            <p>Monitor visitors and statistics</p>
            <div className="page-url">localhost:3000/admin</div>
            <button className="page-btn">Open</button>
          </div>
        </div>

        <div className="home-info">
          <h3>📱 How It Works</h3>
          <ol>
            <li><strong>Entrance Display:</strong> Shows QR code for students to scan</li>
            <li><strong>Students Scan:</strong> Opens registration form on their phone</li>
            <li><strong>Students Register:</strong> Get instant access token</li>
            <li><strong>Security Verifies:</strong> Scans/enters token to grant access</li>
            <li><strong>Admin Monitors:</strong> Views all visitors and statistics</li>
          </ol>
        </div>
      </div>
    </div>
  )
}

export default Home
