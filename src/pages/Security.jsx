import React, { useState, useEffect, useRef } from 'react'
import { Html5QrcodeScanner } from 'html5-qrcode'
import { API_URL, CAMPUS_INSTITUTE_NAME, getCampusAuthHeaders, getSelectedCampus } from '../config'
import { validateSession } from '../auth'

function Security() {
  const [activeCampus, setActiveCampus] = useState(getSelectedCampus())
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [tokenDigits, setTokenDigits] = useState(['', '', '', ''])
  const [result, setResult] = useState(null)
  const [verifying, setVerifying] = useState(false)
  const [scanning, setScanning] = useState(false)
  const digitRefs = [useRef(null), useRef(null), useRef(null), useRef(null)]

  const setDigit = (index, value) => {
    const clean = value.replace(/\D/g, '').slice(0, 1)
    setTokenDigits(prev => {
      const next = [...prev]
      next[index] = clean
      return next
    })
    if (clean && index < 3) {
      digitRefs[index + 1].current?.focus()
    }
  }

  const handleDigitKeyDown = (e, index) => {
    if (e.key === 'Backspace') {
      e.preventDefault()
      if (tokenDigits[index]) {
        setTokenDigits(prev => {
          const next = [...prev]
          next[index] = ''
          return next
        })
      } else if (index > 0) {
        digitRefs[index - 1].current?.focus()
      }
    }
    if (e.key === 'Enter') {
      handleVerify()
    }
  }

  const handlePasteDigits = (e) => {
    e.preventDefault()
    const pasted = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 4)
    if (!pasted) return
    setTokenDigits(prev => {
      const next = [...prev]
      pasted.split('').forEach((ch, i) => {
        next[i] = ch
      })
      return next
    })
    digitRefs[Math.min(pasted.length, 4) - 1].current?.focus()
  }

  useEffect(() => {
    let active = true

    validateSession().then((session) => {
      if (!active) return
      if (session.valid) {
        setIsSuperAdmin(Boolean(session.isSuperAdmin))
        if (!session.isSuperAdmin) {
          setActiveCampus(session.campus || getSelectedCampus())
        }
      }
    })

    return () => {
      active = false
    }
  }, [])

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
        const clean = (decodedText || '').replace(/\D/g, '').slice(0, 4)
        setTokenDigits(['', '', '', ''].map((_, i) => clean[i] || ''))
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
    const manualValue = tokenDigits.join('')
    const value = (tokenValue !== undefined ? tokenValue : manualValue).trim()

    if (!value || value.length !== 4) {
      setResult({ valid: false, error: 'Please enter the 4-digit code' })
      return
    }

    setVerifying(true)
    setResult(null)

    try {
      const response = await fetch(`${API_URL}/verify-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getCampusAuthHeaders(activeCampus)
        },
        body: JSON.stringify({ token: value, campus: activeCampus })
      })

      const data = await response.json()
      setResult(data)
      
      // Auto-reset after 5 seconds for next verification
      if (data.valid) {
        setTimeout(() => {
          setTokenDigits(['', '', '', ''])
          setResult(null)
          digitRefs[0].current?.focus()
        }, 5000)
      }
    } catch (error) {
      setResult({ valid: false, error: 'Network error' })
    } finally {
      setVerifying(false)
    }
  }

  const handleReset = () => {
    setTokenDigits(['', '', '', ''])
    setResult(null)
    digitRefs[0].current?.focus()
  }

  return (
    <div className="fullscreen-container security-page">
      <div className="security-header">
        <img src="/logo.png" alt="Patron Housing" className="page-logo-small" />
        <h1>Security Verification</h1>
        <p>{CAMPUS_INSTITUTE_NAME} • {activeCampus}</p>
      </div>

      <div className="security-content">
        {!result ? (
          <div className="verify-input-section">
            <h2>Verify Resident Access Token</h2>
            <p className="instruction">Scan the resident's QR code, or enter the access code manually below.</p>

            <div className="manual-entry">
              <label htmlFor="token-digit-0" className="token-label">Or enter the 4-digit code manually</label>
              <div className="token-digit-group">
                {tokenDigits.map((digit, index) => (
                  <input
                    key={index}
                    ref={digitRefs[index]}
                    id={`token-digit-${index}`}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => setDigit(index, e.target.value)}
                    onKeyDown={(e) => handleDigitKeyDown(e, index)}
                    onPaste={handlePasteDigits}
                    aria-label={`Digit ${index + 1}`}
                    autoFocus={index === 0}
                    autoComplete="off"
                    className="token-digit-input"
                  />
                ))}
              </div>
              <button
                className="btn btn-verify token-verify-button"
                onClick={() => handleVerify()}
                disabled={verifying || tokenDigits.join('').length !== 4}
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
              <p>💡 You can use the camera to scan the resident's token, or type the 4-digit code into the boxes above.</p>
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
        {isSuperAdmin && (
          <button className="btn btn-secondary" onClick={() => window.location.href = '/campus-selector'}>
            Switch Campus
          </button>
        )}
        <p>Contact administrator for assistance</p>
      </div>
    </div>
  )
}

export default Security
