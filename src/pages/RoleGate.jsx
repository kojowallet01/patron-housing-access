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
      <div className="login-wrap">
        <header className="login-header">
          <img src="/logo.png" alt="Campus Institute" className="login-logo" />
          <h1>{CAMPUS_INSTITUTE_NAME}</h1>
          <p>Click on your campus to log in</p>
        </header>

        <div className="campus-row">
          {CAMPUS_LIST.map((campus) => {
            const isSelected = selectedCampus === campus
            return (
              <button
                key={campus}
                type="button"
                onClick={() => handleCampusSelect(campus)}
                className={`campus-box${isSelected ? ' selected' : ''}`}
                style={{
                  background: CAMPUS_COLORS[campus] || '#2563eb',
                  color: '#ffffff',
                  borderColor: isSelected ? '#ffffff' : 'transparent',
                  boxShadow: isSelected ? '0 0 0 3px rgba(255,255,255,0.9), 0 4px 12px rgba(0,0,0,0.2)' : '0 4px 12px rgba(0, 0, 0, 0.15)'
                }}
              >
                <span>{campus.replace(' CAMPUS', '')}</span>
              </button>
            )
          })}
        </div>

        <div className="login-field">
          <label htmlFor="role-select">Select role</label>
          <select
            id="role-select"
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
          >
            {ROLE_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>

        {selectedCampus && (
          <div className="login-field">
            <label htmlFor="password-input">Password</label>
            <input
              id="password-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
              placeholder={`Enter ${selectedRole.replace('-', ' ')} password`}
            />
          </div>
        )}

        {error && (
          <div className="alert alert-error login-alert">
            {error}
          </div>
        )}

        <button className="login-button" onClick={handleUnlock}>
          LOG IN
        </button>
      </div>
    </div>
  )
}

export default RoleGate
