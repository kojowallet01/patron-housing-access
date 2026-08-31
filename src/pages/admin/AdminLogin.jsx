import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { API_URL, CAMPUS_INSTITUTE_NAME, CAMPUS_LIST, CAMPUS_COLORS, getSelectedCampus, setSelectedCampus } from '../../config'
import { setSession, validateSession } from '../../auth'
import CampusLogo from '../../components/CampusLogo'
import { ShieldCheck, Lock, Eye, EyeOff, ArrowLeft } from 'lucide-react'

function AdminLogin() {
  const navigate = useNavigate()
  const location = useLocation()
  const [selectedCampus, setSelected] = useState(getSelectedCampus())
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let active = true
    validateSession().then((session) => {
      if (!active) return
      if (session.valid && ['admin', 'super-admin'].includes(session.role)) {
        navigate('/admin', { replace: true })
        return
      }
      setChecking(false)
    })
    return () => { active = false }
  }, [navigate])

  const handleCampusSelect = (campus) => {
    setSelected(campus)
    setSelectedCampus(campus)
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const trimmed = password.trim()
    if (!trimmed) {
      setError('Please enter the password.')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      const role = isSuperAdmin ? 'super-admin' : 'admin'
      const response = await fetch(`${API_URL}/validate-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, campus: selectedCampus, password: trimmed })
      })
      const result = await response.json()

      if (!response.ok || !result.valid || !result.sessionToken) {
        setError(isSuperAdmin
          ? 'Invalid super admin password for the selected campus.'
          : 'Invalid admin password for the selected campus.')
        return
      }

      setSession(result.sessionToken, result.role, result.campus)
      setSelectedCampus(result.campus)

      const from = location.state?.from
      navigate(from || '/admin', { replace: true })
    } catch (loginError) {
      console.error('Admin login failed:', loginError)
      setError('Unable to validate login right now. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (checking) {
    return (
      <div className="fullscreen-container auth-loading">
        <div className="loading">Checking access...</div>
      </div>
    )
  }

  return (
    <div className="fullscreen-container role-gate-page">
      <div className="admin-login-card">
        <button type="button" className="admin-login-back" onClick={() => navigate('/')}>
          <ArrowLeft size={16} strokeWidth={2} />
          Back
        </button>

        <header className="login-header admin-login-header">
          <img src="/logo.png" alt="AIFSP" className="login-logo" />
          <h1>{CAMPUS_INSTITUTE_NAME}</h1>
          <p>Admin sign in</p>
        </header>

        <div className="admin-login-body">
          <label className="admin-login-label">Select campus</label>
          <div className="admin-login-campus-grid">
            {CAMPUS_LIST.map((campus) => {
              const isSelected = selectedCampus === campus
              return (
                <button
                  key={campus}
                  type="button"
                  onClick={() => handleCampusSelect(campus)}
                  className={`admin-login-campus${isSelected ? ' selected' : ''}`}
                  style={{
                    borderColor: isSelected ? (CAMPUS_COLORS[campus] || '#2563eb') : '#e2e8f0'
                  }}
                >
                  <span className="admin-login-campus-logo">
                    <CampusLogo campus={campus} />
                  </span>
                  <span className="admin-login-campus-name">{campus.replace(' CAMPUS', '')}</span>
                </button>
              )
            })}
          </div>

          <label className="admin-login-label">Access level</label>
          <div className="admin-login-mode">
            <button
              type="button"
              className={`admin-login-mode-btn${!isSuperAdmin ? ' active' : ''}`}
              onClick={() => setIsSuperAdmin(false)}
            >
              <ShieldCheck size={16} strokeWidth={2} />
              Admin
            </button>
            <button
              type="button"
              className={`admin-login-mode-btn${isSuperAdmin ? ' active' : ''}`}
              onClick={() => setIsSuperAdmin(true)}
            >
              <Lock size={16} strokeWidth={2} />
              Super Admin
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <label htmlFor="admin-password" className="admin-login-label">Password</label>
            <div className="admin-login-password-wrap">
              <Lock size={16} strokeWidth={2} className="admin-login-lock" />
              <input
                id="admin-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError('') }}
                placeholder="Enter password"
                autoComplete="current-password"
              />
              <button
                type="button"
                className="admin-login-toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} strokeWidth={2} /> : <Eye size={18} strokeWidth={2} />}
              </button>
            </div>

            {error && <p className="admin-login-error">{error}</p>}

            <button type="submit" className="admin-login-submit" disabled={submitting}>
              {submitting ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default AdminLogin
