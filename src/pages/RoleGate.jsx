import React, { useState } from 'react'
import { API_URL, CAMPUS_INSTITUTE_NAME, CAMPUS_LIST, CAMPUS_COLORS, getSelectedCampus, setSelectedCampus } from '../config'

function RoleGate({ role, targetPath, title, subtitle, children }) {
  const [selectedRole, setSelectedRole] = useState(role || 'admin')
  const [selectedCampus, setSelected] = useState(getSelectedCampus())
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [locked, setLocked] = useState(false)

  const handleCampusSelect = (campus) => {
    setSelected(campus)
    setSelectedCampus(campus)
    setError('')
  }

  const handleUnlock = async () => {
    const trimmedPassword = password.trim()

    if (!trimmedPassword) {
      setError('Please enter the password.')
      return
    }

    try {
      const response = await fetch(`${API_URL}/validate-login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          role: selectedRole,
          campus: selectedCampus,
          password: trimmedPassword
        })
      })

      const result = await response.json()

      if (!response.ok || !result.valid) {
        setError('Invalid role or password for the selected campus.')
        return
      }

      window.localStorage.setItem('campus-institute-role', selectedRole)
      setSelectedCampus(selectedCampus)
      setLocked(true)
      setError('')
      window.location.href = targetPath
    } catch (error) {
      console.error('Login validation failed:', error)
      setError('Unable to validate login right now. Please try again.')
    }
  }

  if (locked) {
    return children
  }

  return (
    <div className="fullscreen-container home-page">
      <div className="home-header">
        <h1>🏛️ {CAMPUS_INSTITUTE_NAME}</h1>
        <p>{title}</p>
      </div>

      <div className="home-content" style={{ maxWidth: 820 }}>
        <div className="page-card" style={{ padding: '2rem' }}>
          <h3>{subtitle}</h3>
          <p style={{ marginTop: 8 }}>Choose your campus first, then enter your login details.</p>

          <div style={{ marginTop: 24 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
              {CAMPUS_LIST.map((campus) => {
                const isSelected = selectedCampus === campus
                return (
                  <button
                    key={campus}
                    type="button"
                    onClick={() => handleCampusSelect(campus)}
                    className="campus-card"
                    style={{
                      background: CAMPUS_COLORS[campus] || '#475569',
                      border: isSelected ? '3px solid #ffffff' : '3px solid rgba(255,255,255,0.2)',
                      boxShadow: isSelected ? '0 12px 24px rgba(15, 23, 42, 0.2)' : 'none',
                      transform: isSelected ? 'translateY(-2px)' : 'none'
                    }}
                  >
                    <span className="campus-card-title">{campus.replace(' CAMPUS', '')}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div style={{ marginTop: 24, display: 'grid', gap: 16 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Select role</label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="security-input"
                style={{ width: '100%' }}
              >
                <option value="admin">Admin</option>
                <option value="security">Security</option>
                <option value="super-admin">Super Admin</option>
              </select>
            </div>

            {selectedCampus && (
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={`Enter ${selectedRole.replace('-', ' ')} password for ${selectedCampus}`}
                  className="security-input"
                  style={{ width: '100%' }}
                />
              </div>
            )}
          </div>

          {error && (
            <div className="alert alert-error" style={{ marginTop: 16 }}>
              {error}
            </div>
          )}

          <button className="btn btn-primary" style={{ marginTop: 20, width: '100%' }} onClick={handleUnlock}>
            Unlock {selectedRole.toUpperCase().replace('-', ' ')} Dashboard
          </button>
        </div>
      </div>
    </div>
  )
}

export default RoleGate
