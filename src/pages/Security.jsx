import React, { useState, useEffect } from 'react'
import { Html5QrcodeScanner } from 'html5-qrcode'
import { API_URL, CAMPUS_INSTITUTE_NAME, getCampusAuthHeaders, getSelectedCampus } from '../config'

function Security() {
  const campus = getSelectedCampus()
  const [token, setToken] = useState('')
  const [result, setResult] = useState(null)
  const [verifying, setVerifying] = useState(false)
  const [scanning, setScanning] = useState(false)

  useEffect(() => {
    if (!scanning) return

    const scanner = new Html5QrcodeScanner('security-qr-scanner', {
      fps: 10,
      qrbox: { width: 250, height: 250 }
    }, false)

    scanner.render(
      (decodedText) => {
        scanner.clear().catch(() => {})
        setScanning(false)
        setToken(decodedText)
        handleVerify(decodedText)
      },
      () => {
        // Ignore per-frame errors while scanning
      }
    )

    return () => {
      scanner.clear().catch(() => {})
    }
  }, [scanning])

  const handleVerify = async (tokenValue) => {
    const value = (tokenValue !== undefined ? tokenValue : token).trim()

    if (!value) {
      setResult({ valid: false, error: 'Please enter a token' })
      return
    }

    setVerifying(true)
    setResult(null)

    try {
      const response = await fetch(`${API_URL}/verify-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getCampusAuthHeaders('security')
        },
        body: JSON.stringify({ token: value, campus })
      })

      const data = await response.json()
      setResult(data)
      
      // Auto-reset after 5 seconds for next verification
      if (data.valid) {
        setTimeout(() => {
          setToken('')
          setResult(null)
        }, 5000)
      }
    } catch (error) {
      setResult({ valid: false, error: 'Network error' })
    } finally {
      setVerifying(false)
    }
  }

  const handleReset = () => {
    setToken('')
    setResult(null)
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleVerify()
    }
  }

  return (
    <div className="fullscreen-container security-page">
      <div className="security-header">
        <img src="/logo.png" alt="Patron Housing" className="page-logo-small" />
        <h1>Security Verification</h1>
        <p>{CAMPUS_INSTITUTE_NAME} • {campus}</p>
      </div>

      <div className="security-content">
        {!result ? (
          <div className="verify-input-section">
            <h2>Verify Resident Access Token</h2>
            <p className="instruction">Scan or enter the resident's token below</p>
            
            <div className="token-input-group">
              <input
                type="text"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Enter token or scan QR code"
                className="security-input"
                autoFocus
              />
              <button 
                className="btn btn-verify" 
                onClick={() => handleVerify()}
                disabled={verifying || !token}
              >
                {verifying ? '⏳ Verifying...' : '✓ Verify'}
              </button>
            </div>

            <div className="scan-toggle">
              <button
                className="btn btn-secondary"
                onClick={() => setScanning(s => !s)}
              >
                {scanning ? '✕ Stop Scanner' : '📷 Scan QR Code'}
              </button>
            </div>

            {scanning && (
              <div id="security-qr-scanner" className="qr-scanner" />
            )}

            <div className="security-tip">
              <p>💡 You can also use a QR scanner to read the student's token</p>
            </div>
          </div>
        ) : (
          <div className="verify-result">
            {result.valid ? (
              <div className="result-granted">
                <div className="result-icon">✅</div>
                <h2>ACCESS GRANTED</h2>

                {result.student.flagged && (
                  <div className="flag-warning">
                    <div className="flag-warning-icon">⚠️</div>
                    <div className="flag-warning-title">FLAGGED RESIDENT</div>
                    <div className="flag-warning-note">{result.student.flagNote || 'No reason given'}</div>
                  </div>
                )}

                <div className="student-info">
                  <div className="info-row">
                    <span className="label">Name:</span>
                    <span className="value">{result.student.name}</span>
                  </div>
                  <div className="info-row">
                    <span className="label">Phone:</span>
                    <span className="value">{result.student.phone}</span>
                  </div>
                  {result.student.purpose && (
                    <div className="info-row">
                      <span className="label">Purpose:</span>
                      <span className="value">{result.student.purpose}</span>
                    </div>
                  )}
                  <div className="info-row">
                    <span className="label">Valid Date:</span>
                    <span className="value">{result.validDate}</span>
                  </div>
                </div>

                <p className="auto-reset">Automatically resetting in 5 seconds...</p>
                
                <button className="btn btn-secondary" onClick={handleReset}>
                  Verify Another
                </button>
              </div>
            ) : (
              <div className="result-denied">
                <div className="result-icon">❌</div>
                <h2>ACCESS DENIED</h2>
                <div className="error-message">
                  {result.error || 'Invalid or expired token'}
                </div>
                <button className="btn btn-primary" onClick={handleReset}>
                  Try Again
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="security-footer">
        <button className="btn btn-secondary" onClick={() => window.location.href = '/campus-selector'}>
          Switch Campus
        </button>
        <p>Contact administrator for assistance</p>
      </div>
    </div>
  )
}

export default Security
