import React, { useState, useEffect } from 'react'

function Register() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    home_campus: ''
  })
  const [campusCode, setCampusCode] = useState('')
  const [token, setToken] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Get campus code from URL
    const params = new URLSearchParams(window.location.search)
    const code = params.get('campus')
    setCampusCode(code)
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // First, register the student
      const registerResponse = await fetch('http://localhost:3001/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      const registerData = await registerResponse.json()

      if (!registerResponse.ok) {
        setError(registerData.error || 'Registration failed')
        setLoading(false)
        return
      }

      // Then immediately generate access token
      const tokenResponse = await fetch('http://localhost:3001/api/generate-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          campusCode: campusCode
        })
      })

      const tokenData = await tokenResponse.json()

      if (tokenResponse.ok) {
        setToken(tokenData)
      } else {
        setError(tokenData.error || 'Failed to generate token')
      }
    } catch (err) {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  // Show token screen after successful registration
  if (token) {
    return (
      <div className="card">
        <div className="token-display">
          <div style={{ fontSize: '4rem', marginBottom: '10px' }}>✅</div>
          <h2 style={{ color: '#28a745', marginBottom: '10px' }}>Registration Complete!</h2>
          <p style={{ fontSize: '1.1rem', marginBottom: '30px' }}>
            Welcome, <strong>{token.student.name}</strong>
          </p>
          
          <div style={{ 
            background: '#f8f9fa', 
            padding: '30px', 
            borderRadius: '12px',
            marginBottom: '20px'
          }}>
            <h3 style={{ color: '#667eea', marginBottom: '15px' }}>Your Access Token</h3>
            <img 
              src={token.tokenQR} 
              alt="Access Token QR" 
              style={{ maxWidth: '280px', margin: '0 auto', display: 'block' }}
            />
          </div>
          
          <div style={{ 
            background: '#fff3cd', 
            border: '2px solid #ffc107',
            padding: '20px', 
            borderRadius: '8px',
            marginBottom: '20px'
          }}>
            <p style={{ fontSize: '1rem', color: '#856404', margin: 0 }}>
              📱 <strong>Show this QR code to security at the entrance</strong>
            </p>
          </div>

          <div className="token-code">
            <strong>Token ID:</strong> {token.token}
          </div>
          
          <p style={{ fontSize: '0.9rem', color: '#666', marginTop: '15px' }}>
            Valid for today: {new Date().toLocaleDateString()}
          </p>

          <div style={{ 
            marginTop: '30px', 
            padding: '15px',
            background: '#e7f3ff',
            borderRadius: '8px',
            fontSize: '0.9rem',
            color: '#004085'
          }}>
            <p><strong>💡 Tip:</strong> Take a screenshot of this page or save this token for entry.</p>
          </div>
        </div>
      </div>
    )
  }

  // Show registration form
  return (
    <div className="card">
      <h2>📝 Student Registration</h2>
      <p style={{ color: '#666', marginBottom: '20px' }}>
        Welcome to Tesano Campus Institute! Please fill in your details to get your access token.
      </p>

      {error && (
        <div className="alert alert-error">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Full Name *</label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            placeholder="Enter your full name"
          />
        </div>

        <div className="form-group">
          <label>Email *</label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            required
            placeholder="your.email@example.com"
          />
        </div>

        <div className="form-group">
          <label>Phone Number</label>
          <input
            type="tel"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            placeholder="+233 XX XXX XXXX"
          />
        </div>

        <div className="form-group">
          <label>Home Campus / Institution</label>
          <input
            type="text"
            name="home_campus"
            value={formData.home_campus}
            onChange={handleChange}
            placeholder="Your home campus or institution"
          />
        </div>

        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Processing...' : 'Register & Get Access Token'}
        </button>
      </form>
    </div>
  )
}

export default Register
