import React, { useState, useEffect } from 'react'

function Entrance() {
  const [qrCode, setQrCode] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchQRCode()
    // Refresh QR code every 30 seconds to keep connection alive
    const interval = setInterval(fetchQRCode, 30000)
    return () => clearInterval(interval)
  }, [])

  const fetchQRCode = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/campus-qr')
      const data = await response.json()
      
      setQrCode(data)
    } catch (error) {
      console.error('Error fetching QR code:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="fullscreen-container">
        <div className="loading">Loading entrance display...</div>
      </div>
    )
  }

  return (
    <div className="fullscreen-container entrance-page">
      <div className="entrance-header">
        <img src="/logo.png" alt="Patron Housing" className="page-logo" />
        <h1>Patron Housing</h1>
        <p>Secure Access Management System</p>
      </div>

      <div className="entrance-content">
        <h2>Scan to Get Access Into Building</h2>
        
        <div className="qr-container">
          {qrCode && (
            <img 
              src={qrCode.qrCodeUrl || qrCode.qrCode} 
              alt="Scan to Get Access" 
              className="entrance-qr"
            />
          )}
        </div>

        <div className="instructions">
          <h3>📱 How to Get Access:</h3>
          <div className="steps">
            <div className="step">
              <span className="step-number">1</span>
              <span>Scan QR code with your phone</span>
            </div>
            <div className="step">
              <span className="step-number">2</span>
              <span>Fill registration form</span>
            </div>
            <div className="step">
              <span className="step-number">3</span>
              <span>Receive your access token</span>
            </div>
            <div className="step">
              <span className="step-number">4</span>
              <span>Show token to security</span>
            </div>
          </div>
        </div>
      </div>

      <div className="entrance-footer">
        <p>For assistance, please contact building staff</p>
      </div>
    </div>
  )
}

export default Entrance
