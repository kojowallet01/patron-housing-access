import React, { useState, useEffect } from 'react'
import { API_URL, CAMPUS_INSTITUTE_NAME, CAMPUS_LIST, DEFAULT_CAMPUS, getSelectedCampus, setSelectedCampus } from '../config'

function Entrance() {
  const [selectedCampus, setSelected] = useState(getSelectedCampus())
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
      const response = await fetch(`${API_URL}/campus-qr`)
      const data = await response.json()

      setQrCode(data)
    } catch (error) {
      console.error('Error fetching QR code:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCampusChange = (campus) => {
    setSelected(campus)
    setSelectedCampus(campus)
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
        <h1>{CAMPUS_INSTITUTE_NAME}</h1>
        <p>{selectedCampus} access management system</p>
      </div>

      <div className="entrance-content">
        <div style={{ marginBottom: 20 }}>
          <h3>Choose campus</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
            {CAMPUS_LIST.map((campus) => (
              <button
                key={campus}
                className={`btn ${selectedCampus === campus ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => handleCampusChange(campus)}
              >
                {campus}
              </button>
            ))}
          </div>
        </div>
        <h2>Scan to Get Access Into Building</h2>
        
        <div className="qr-container">
          {qrCode && (
            qrCode.registrationUrl ? (
              <a href={qrCode.registrationUrl} target="_blank" rel="noreferrer" className="qr-link">
                <img
                  src={qrCode.qrCodeUrl || qrCode.qrCode}
                  alt="Scan to register and get access"
                  className="entrance-qr"
                />
              </a>
            ) : (
              <img
                src={qrCode.qrCodeUrl || qrCode.qrCode}
                alt="Scan to Get Access"
                className="entrance-qr"
              />
            )
          )}
        </div>

        {qrCode?.registrationUrl && (
          <div className="registration-link-card">
            <a href={qrCode.registrationUrl} target="_blank" rel="noreferrer" className="btn btn-primary registration-link">
              Open Registration Form
            </a>
          </div>
        )}

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
