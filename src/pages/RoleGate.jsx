import React, { useState, useEffect } from 'react'
import { API_URL, CAMPUS_INSTITUTE_NAME, CAMPUS_LIST, CAMPUS_COLORS, getSelectedCampus, setSelectedCampus } from '../config'
import { setSession, validateSession } from '../auth'

const ALLOWED_ROLES = {
  admin: ['admin', 'super-admin'],
  security: ['security', 'super-admin']
}

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'security', label: 'Security' },
  { value: 'super-admin', label: 'Super Admin' }
]

function RoleGate({ role, title, subtitle, children }) {
  const [selectedRole, setSelectedRole] = useState(role || 'admin')
  const [selectedCampus, setSelected] = useState(getSelectedCampus())
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [checkingSession, setCheckingSession] = useState(true)
  const [unlocked, setUnlocked] = useState(false)

  useEffect(() => {
    let active = true

    async function checkExistingSession() {
      const session = await validateSession()
      if (!active) return

      const allowedRoles = ALLOWED_ROLES[role] || [role]
      if (session.valid && allowedRoles.includes(session.role)) {
        setUnlocked(true)
      }
      setCheckingSession(false)
    }

    checkExistingSession()
    return () => {
      active = false
    }
  }, [role])

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

      if (!response.ok || !result.valid || !result.sessionToken) {
        setError('Invalid role or password for the selected campus.')
        return
      }

      setSession(result.sessionToken, result.role, result.campus)
      setSelectedCampus(result.campus)
      setUnlocked(true)
      setError('')
    } catch (loginError) {
      console.error('Login validation failed:', loginError)
      setError('Unable to validate login right now. Please try again.')
    }
  }

  if (checkingSession) {
    return (
      <div className="fullscreen-container">
        <div className="loading">Checking access...</div>
      </div>
    )
  }

  if (unlocked) {
    return children
  }

  return (
    <div className="fullscreen-container role-gate-page">
      <div className="home-header">
        <h1>🏛️ {CAMPUS_INSTITUTE_NAME}</h1>
        <p>{title}</p>
      </div>

      <div className="home-content" style={{ maxWidth: 720 }}>
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
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

            {selectedCampus && (
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
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
            Unlock ADMIN Dashboard
          </button>
        </div>
      </div>
    </div>
  )
}

export default RoleGate
