import React, { useState } from 'react'

function Security() {
  const [token, setToken] = useState('')
  const [result, setResult] = useState(null)
  const [verifying, setVerifying] = useState(false)

  const handleVerify = async () => {
    if (!token) {
      setResult({ valid: false, error: 'Please enter a token' })
      return
    }

    setVerifying(true)
    setResult(null)

    try {
      const response = await fetch('http://localhost:3001/api/verify-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token.trim() })
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
        <p>Patron Housing</p>
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
                onClick={handleVerify}
                disabled={verifying || !token}
              >
                {verifying ? '⏳ Verifying...' : '✓ Verify'}
              </button>
            </div>

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
        <p>Contact administrator for assistance</p>
      </div>
    </div>
  )
}

export default Security
