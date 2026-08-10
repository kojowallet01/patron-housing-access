import React, { useState, useEffect } from 'react'
import { API_URL } from '../config'

function RegisterPage() {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    purpose: '',
    purposeOther: ''
  })
  const [campusCode, setCampusCode] = useState('')
  const [token, setToken] = useState(null)
  const [error, setError] = useState(null)
  const [statusMessage, setStatusMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [campusQr, setCampusQr] = useState(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('campus')

    if (!code) {
      setError('Invalid registration link. Please scan the QR code at the entrance.')
    }

    setCampusCode(code)
    fetchCampusQr()
  }, [])

  const fetchCampusQr = async () => {
    try {
      const response = await fetch(`${API_URL}/campus-qr`)
      const data = await response.json()
      setCampusQr(data)
    } catch (err) {
      console.error('Unable to load campus QR code', err)
    }
  }

  const requestToken = async () => {
    const response = await fetch(`${API_URL}/generate-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: formData.phone.trim(),
        campusCode: campusCode
      })
    })

    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.error || 'Failed to generate token')
    }

    return data
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setStatusMessage('')
    setLoading(true)

    try {
      const name = formData.name.trim()
      const phone = formData.phone.trim()
      const purpose = formData.purpose === 'Other' 
        ? formData.purposeOther.trim() 
        : formData.purpose

      console.log('Form data:', { name, phone, purpose, formData }) // Debug log

      if (!campusCode) {
        setError('Invalid registration link. Please scan the QR code at the entrance.')
        setLoading(false)
        return
      }

      if (!name || !phone || !formData.purpose) {
        const missingFields = []
        if (!name) missingFields.push('Name')
        if (!phone) missingFields.push('Phone')
        if (!formData.purpose) missingFields.push('Purpose')
        setError(`Please fill in: ${missingFields.join(', ')}`)
        setLoading(false)
        return
      }

      if (formData.purpose === 'Other' && !formData.purposeOther.trim()) {
        setError('Please specify the purpose of your visit.')
        setLoading(false)
        return
      }

      console.log('Sending registration:', { name, phone, purpose }) // Debug log

      const registerResponse = await fetch(`${API_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          phone,
          purpose
        })
      })

      const registerData = await registerResponse.json()
      
      console.log('Registration response:', registerData) // Debug log

      let tokenData
      if (registerResponse.ok) {
        tokenData = await requestToken()
      } else if (registerData.error === 'Phone already registered') {
        setStatusMessage('Phone already registered. Generating your access token now...')
        tokenData = await requestToken()
      } else {
        setError(registerData.error || 'Registration failed')
        setLoading(false)
        return
      }

      setToken(tokenData)
    } catch (err) {
      console.error('Registration error:', err) // Debug log
      setError(err.message || 'Network error. Please try again.')
      setLoading(false)
    }
  }

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleCopyToken = async () => {
    if (!token?.token) {
      return
    }

    try {
      await navigator.clipboard.writeText(token.token)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Unable to copy token', err)
    }
  }

  const goBackHome = () => {
    window.location.href = '/'
  }

  if (token) {
    return (
      <div className="mobile-container">
        <div className="mobile-header">
          <img src="/logo.png" alt="Patron Housing" className="mobile-logo" />
          <h1>Patron Housing</h1>
        </div>

        <div className="token-success">
          <div className="success-icon">✅</div>
          <h2>Registration Complete!</h2>
          <p className="welcome-text">Welcome, <strong>{token.student.name}</strong></p>

          <div className="token-qr-box">
            <h3>Your Access Token</h3>
            <img
              src={token.tokenQR}
              alt="Access Token"
              className="token-qr"
            />
          </div>

          <div className="token-alert">
            📱 <strong>Show this QR code to security at the building entrance.</strong>
          </div>

          <div className="token-details">
            <p><strong>Token ID</strong></p>
            <p className="token-id">{token.token}</p>
            <p className="valid-date">Valid for: {new Date().toLocaleDateString()}</p>
          </div>

          <div className="token-actions">
            <button className="btn btn-secondary" onClick={handleCopyToken}>
              {copied ? 'Copied!' : 'Copy Token ID'}
            </button>
            <button className="btn btn-primary" onClick={goBackHome}>
              Back to Entrance
            </button>
          </div>

          <div className="token-tip">
            💡 Tip: Keep this page open or take a screenshot for a faster entry.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mobile-container">
      <div className="mobile-header">
        <img src="/logo.png" alt="Patron Housing" className="mobile-logo" />
        <h1>Patron Housing</h1>
        <p>Secure Access Management System</p>
      </div>

      <div className="mobile-content">
        <h2>📝 Resident Registration</h2>
        <p className="subtitle">Fill in your details to get your building access token instantly.</p>

        {statusMessage && (
          <div className="alert alert-success">
            {statusMessage}
          </div>
        )}

        {error && (
          <div className="alert alert-error">
            {error}
          </div>
        )}

        {campusQr && (
          <div className="signup-qr-card">
            <h3>Building Access QR</h3>
            <img
              src={campusQr.qrCodeUrl || campusQr.qrCode}
              alt="Building Access QR"
              className="signup-qr"
            />
            <p>
              Scan this code at the building entrance or use it from another device to open the registration form.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mobile-form">
          <div className="form-group">
            <label>1. Please enter your name *</label>
            <p className="field-description">Identifies everyone using the facility and promotes accountability.</p>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              placeholder="Enter your answer"
            />
          </div>

          <div className="form-group">
            <label>2. Please provide your number *</label>
            <p className="field-description">Enables us to contact you if there is an emergency or if personal belongings are left behind.</p>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              required
              placeholder="Please enter a whole number"
            />
          </div>

          <div className="form-group">
            <label>3. Purpose of Your Visit *</label>
            <p className="field-description">Helps us understand how the building is being used and improve planning for activities.</p>
            
            <div className="radio-group">
              <label className="radio-option">
                <input
                  type="radio"
                  name="purpose"
                  value="Institute Class"
                  checked={formData.purpose === 'Institute Class'}
                  onChange={handleChange}
                  required
                />
                <span>Institute Class</span>
              </label>

              <label className="radio-option">
                <input
                  type="radio"
                  name="purpose"
                  value="Personal Study"
                  checked={formData.purpose === 'Personal Study'}
                  onChange={handleChange}
                />
                <span>Personal Study</span>
              </label>

              <label className="radio-option">
                <input
                  type="radio"
                  name="purpose"
                  value="Meeting"
                  checked={formData.purpose === 'Meeting'}
                  onChange={handleChange}
                />
                <span>Meeting</span>
              </label>

              <label className="radio-option">
                <input
                  type="radio"
                  name="purpose"
                  value="Social Activity"
                  checked={formData.purpose === 'Social Activity'}
                  onChange={handleChange}
                />
                <span>Social Activity</span>
              </label>

              <label className="radio-option">
                <input
                  type="radio"
                  name="purpose"
                  value="Office/Administrative Business"
                  checked={formData.purpose === 'Office/Administrative Business'}
                  onChange={handleChange}
                />
                <span>Office/Administrative Business</span>
              </label>

              <label className="radio-option">
                <input
                  type="radio"
                  name="purpose"
                  value="Other"
                  checked={formData.purpose === 'Other'}
                  onChange={handleChange}
                />
                <span>Other (please specify)</span>
              </label>

              {formData.purpose === 'Other' && (
                <input
                  type="text"
                  name="purposeOther"
                  value={formData.purposeOther}
                  onChange={handleChange}
                  placeholder="Please specify"
                  className="other-input"
                  required
                />
              )}
            </div>
          </div>

          <button type="submit" className="btn btn-primary btn-large" disabled={loading || !campusCode}>
            {loading ? 'Processing...' : 'Submit & Get Access Token'}
          </button>
        </form>

        {!campusCode && (
          <div className="alert alert-error" style={{ marginTop: '20px' }}>
            Invalid registration link. Please scan the QR code at the entrance.
          </div>
        )}
      </div>
    </div>
  )
}

export default RegisterPage
