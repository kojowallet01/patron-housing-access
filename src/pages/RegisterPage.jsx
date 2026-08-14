import { useState, useEffect } from 'react'
import { API_URL, CAMPUS_INSTITUTE_NAME, DEFAULT_CAMPUS } from '../config'

function RegisterPage() {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    purpose: '',
    purposeOther: ''
  })
  const [campusCode, setCampusCode] = useState('')
  const [campusName, setCampusName] = useState(DEFAULT_CAMPUS)
  const [token, setToken] = useState(null)
  const [error, setError] = useState(null)
  const [statusMessage, setStatusMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const codeParam = params.get('code')
    const campusParam = params.get('campus')

    if (codeParam) {
      setCampusCode(codeParam)
      if (campusParam) {
        setCampusName(decodeURIComponent(campusParam))
      }
      return
    }

    if (campusParam) {
      setCampusName(decodeURIComponent(campusParam))
      fetch(`${API_URL}/campus-qr?campus=${encodeURIComponent(decodeURIComponent(campusParam))}`)
        .then((response) => {
          if (!response.ok) {
            throw new Error('Failed to resolve campus code')
          }
          return response.json()
        })
        .then((data) => {
          if (data?.code) {
            setCampusCode(data.code)
          } else {
            setError('Invalid registration link. Please scan the QR code at the entrance.')
          }
        })
        .catch(() => {
          setError('Invalid registration link. Please scan the QR code at the entrance.')
        })
      return
    }

    setError('Invalid registration link. Please scan the QR code at the entrance.')
  }, [])

  const requestToken = async (phone) => {
    const response = await fetch(`${API_URL}/generate-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: phone.trim(),
        campusCode,
        code: campusCode,
        campus: campusName
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

      if (!campusCode) {
        setError('Invalid registration link. Please scan the QR code at the entrance.')
        return
      }

      if (!name || !phone || !formData.purpose) {
        const missingFields = []
        if (!name) missingFields.push('Name')
        if (!phone) missingFields.push('Phone')
        if (!formData.purpose) missingFields.push('Purpose')
        setError(`Please fill in: ${missingFields.join(', ')}`)
        return
      }

      if (formData.purpose === 'Other' && !formData.purposeOther.trim()) {
        setError('Please specify the purpose of your visit.')
        return
      }

      const registerResponse = await fetch(`${API_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          phone,
          purpose,
          campus: campusName
        })
      })

      const registerData = await registerResponse.json()

      let tokenData
      if (registerResponse.ok) {
        tokenData = await requestToken(phone)
      } else if (registerData.error?.includes('Phone already registered')) {
        setStatusMessage('Phone already registered for this campus. Generating your access token now...')
        tokenData = await requestToken(phone)
      } else {
        setError(registerData.error || 'Registration failed')
        return
      }

      setToken(tokenData)
    } catch (err) {
      setError(err.message || 'Network error. Please try again.')
    } finally {
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
          <h1>{CAMPUS_INSTITUTE_NAME}</h1>
        </div>

        <div className="token-success">
          <div className="success-icon">✅</div>
          <h2>Registration Complete!</h2>
          <p className="welcome-text">Welcome, <strong>{token.student.name}</strong></p>
          <p className="subtitle">{token.campus || campusName}</p>

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
        <h1>{CAMPUS_INSTITUTE_NAME}</h1>
        <p>{campusName} • Secure Access Management</p>
      </div>

      <div className="mobile-content">
        <h2>📝 Student Registration</h2>
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
              {[
                'Institute Class',
                'Personal Study',
                'Meeting',
                'Social Activity',
                'Office/Administrative Business',
                'Other'
              ].map((option) => (
                <label key={option} className="radio-option">
                  <input
                    type="radio"
                    name="purpose"
                    value={option}
                    checked={formData.purpose === option}
                    onChange={handleChange}
                    required={option === 'Institute Class'}
                  />
                  <span>{option === 'Other' ? 'Other (please specify)' : option}</span>
                </label>
              ))}

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
