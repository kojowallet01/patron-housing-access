import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { API_URL, CAMPUS_INSTITUTE_NAME } from '../config'

function AccessQR() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const campus = searchParams.get('campus') || ''

  const [qrCode, setQrCode] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchQRCode = useCallback(async (campusName) => {
    try {
      setLoading(true)
      setError('')
      const response = await fetch(`${API_URL}/campus-qr?campus=${encodeURIComponent(campusName)}`)
      if (!response.ok) {
        throw new Error('Failed to load QR code')
      }
      const data = await response.json()
      setQrCode(data)
    } catch (err) {
      console.error('Error fetching QR code:', err)
      setError('Unable to load the access QR code. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!campus) return
    fetchQRCode(campus)
    const interval = setInterval(() => fetchQRCode(campus), 30000)
    return () => clearInterval(interval)
  }, [campus, fetchQRCode])

  const goBack = () => {
    navigate('/')
  }

  return (
    <div className="fullscreen-container role-gate-page">
      <div className="login-wrap">
        <header className="login-header">
          <img src="/logo.png" alt="Campus Institute" className="login-logo" />
          <h1>{CAMPUS_INSTITUTE_NAME}</h1>
          <p>{campus}</p>
        </header>

        {error && (
          <div className="alert alert-error login-alert">{error}</div>
        )}

        <h2 className="access-qr-heading">Scan to Get Access Into Building</h2>

        <div className="qr-container access-qr-container">
          {loading && !qrCode ? (
            <div className="loading">Loading access QR code...</div>
          ) : (
            qrCode && (
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
            )
          )}
        </div>

        {qrCode?.registrationUrl && (
          <a href={qrCode.registrationUrl} target="_blank" rel="noreferrer" className="btn btn-primary registration-link">
            Open Registration Form
          </a>
        )}

        <div className="access-steps">
          <div className="access-step">
            <span className="step-number">1</span>
            <span>Scan QR code with your phone</span>
          </div>
          <div className="access-step">
            <span className="step-number">2</span>
            <span>Answer the registration questions</span>
          </div>
          <div className="access-step">
            <span className="step-number">3</span>
            <span>Receive your access code</span>
          </div>
          <div className="access-step">
            <span className="step-number">4</span>
            <span>Show the code to security for confirmation</span>
          </div>
        </div>

        <button className="login-button" onClick={goBack}>
          ← Back to Campus Selection
        </button>
      </div>
    </div>
  )
}

export default AccessQR
