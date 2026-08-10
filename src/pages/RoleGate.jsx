import React, { useState } from 'react'
import { CAMPUS_INSTITUTE_NAME, CAMPUS_LIST, getSelectedCampus, setSelectedCampus } from '../config'

function RoleGate({ role, targetPath, title, subtitle, children }) {
  const [selectedRole, setSelectedRole] = useState(role || 'admin')
  const [selectedCampus, setSelected] = useState(getSelectedCampus())
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [locked, setLocked] = useState(false)

  const getExpectedPassword = (nextRole) => {
    if (nextRole === 'admin') return import.meta.env.VITE_ADMIN_TOKEN || ''
    if (nextRole === 'security') return import.meta.env.VITE_SECURITY_TOKEN || ''
    return import.meta.env.VITE_SUPER_ADMIN_TOKEN || 'super-admin-secret'
  }

  const handleUnlock = () => {
    const trimmedPassword = password.trim()

    if (!trimmedPassword) {
      setError('Please enter the password.')
      return
    }

    const expectedPassword = getExpectedPassword(selectedRole)
    const superAdminPassword = import.meta.env.VITE_SUPER_ADMIN_TOKEN || 'super-admin-secret'

    if (trimmedPassword === expectedPassword || trimmedPassword === superAdminPassword) {
      setSelectedCampus(selectedCampus)
      setLocked(true)
      setError('')
      window.location.href = targetPath
      return
    }

    setError('Invalid role or password for the selected campus.')
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

      <div className="home-content" style={{ maxWidth: 700 }}>
        <div className="page-card" style={{ padding: '2rem' }}>
          <h3>{subtitle}</h3>
          <p>Select role, campus, and password to unlock the dashboard.</p>

          <div style={{ display: 'grid', gap: 16, marginTop: 20 }}>
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

            <div>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Select campus</label>
              <select
                value={selectedCampus}
                onChange={(e) => {
                  const nextCampus = e.target.value
                  setSelected(nextCampus)
                  setSelectedCampus(nextCampus)
                }}
                className="security-input"
                style={{ width: '100%' }}
              >
                {CAMPUS_LIST.map((campus) => (
                  <option key={campus} value={campus}>{campus}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={`Enter ${selectedRole.replace('-', ' ')} password`}
                className="security-input"
                style={{ width: '100%' }}
              />
            </div>
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
