import React, { useState, useEffect, useCallback } from 'react'
import {
  ShieldCheck,
  Eye,
  EyeOff,
  UserCog,
  UserShield,
  Crown,
  Lock,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react'
import { API_URL, getCampusAuthHeaders } from '../../config'
import { useAdminContext } from './AdminLayout'

const CAMPUSES = ['TESANO CAMPUS', 'CANTOMENT CAMPUS', 'ASHIAMAN CAMPUS', 'LEGON CAMPUS', 'TEMA CAMPUS']

const ROLES = [
  { value: 'admin', label: 'Admin', icon: UserCog, desc: 'Access for campus administrators' },
  { value: 'security', label: 'Security', icon: UserShield, desc: 'Access for security personnel' },
  { value: 'super-admin', label: 'Super Admin', icon: Crown, desc: 'Full access across all campuses' }
]

function PasswordManager() {
  const { activeCampus, isSuperAdmin, refreshKey } = useAdminContext()
  const [selectedCampus, setSelectedCampus] = useState(CAMPUSES[0])
  const [credentialMap, setCredentialMap] = useState({ admin: {}, security: {}, superAdmin: {} })
  const [draftPasswords, setDraftPasswords] = useState({})
  const [visibleRoles, setVisibleRoles] = useState({})
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [confirmTarget, setConfirmTarget] = useState(null)

  const fetchPasswordMap = useCallback(async () => {
    try {
      setLoading(true)
      const authHeaders = getCampusAuthHeaders(activeCampus)
      const response = await fetch(`${API_URL}/super-admin/passwords`, { headers: authHeaders })
      if (!response.ok) {
        throw new Error('Unable to fetch password map')
      }
      const data = await response.json()
      setCredentialMap({
        admin: data.admin || {},
        security: data.security || {},
        superAdmin: data.superAdmin || {}
      })
    } catch (error) {
      console.error('Error fetching credential map:', error)
    } finally {
      setLoading(false)
    }
  }, [activeCampus])

  useEffect(() => {
    fetchPasswordMap()
  }, [fetchPasswordMap, refreshKey])

  const handleDraftChange = (role, value) => {
    setDraftPasswords((prev) => ({ ...prev, [role]: value }))
  }

  const toggleVisibility = (role) => {
    setVisibleRoles((prev) => ({ ...prev, [role]: !prev[role] }))
  }

  const currentValue = (role) =>
    draftPasswords[role] ?? credentialMap[role]?.[selectedCampus] ?? ''

  const requestConfirm = (role) => {
    setConfirmTarget({ role })
  }

  const savePassword = async () => {
    const role = confirmTarget.role
    const value = draftPasswords[role]?.trim()

    if (!value) {
      setMessage('Password cannot be empty.')
      setConfirmTarget(null)
      return
    }

    try {
      const authHeaders = getCampusAuthHeaders(activeCampus)
      const response = await fetch(`${API_URL}/super-admin/passwords`, {
        method: 'POST',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ campus: selectedCampus, role, password: value })
      })

      if (!response.ok) {
        throw new Error('Failed to save password')
      }

      setMessage(`${role.toUpperCase()} password saved for ${selectedCampus}.`)
      setConfirmTarget(null)
      setDraftPasswords((prev) => ({ ...prev, [role]: undefined }))
      await fetchPasswordMap()
    } catch (error) {
      console.error('Error saving campus password:', error)
      setMessage('Unable to save the password at the moment.')
      setConfirmTarget(null)
    }
  }

  if (!isSuperAdmin) {
    return (
      <div className="admin-page-container">
        <div className="admin-card admin-access-denied">
          <div className="admin-access-denied-icon">
            <ShieldCheck size={32} strokeWidth={1.5} />
          </div>
          <h1 className="admin-page-title">Super Admin Access Required</h1>
          <p>Only super admins can manage campus passwords. Log in as a super admin to continue.</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="admin-page-container">
        <div className="admin-loading-card">Loading password settings...</div>
      </div>
    )
  }

  const roleLabels = { admin: 'Admin', security: 'Security', 'super-admin': 'Super Admin' }

  return (
    <div className="admin-page-container">
      <div className="admin-page-heading">
        <div>
          <h1 className="admin-page-title">Security & Passwords</h1>
          <p className="admin-page-subtitle">Manage role-based access passwords per campus</p>
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-card-header">
          <div className="admin-card-title">
            <ShieldCheck size={18} strokeWidth={2} />
            <h2>Select Campus</h2>
          </div>
          <span className="admin-card-badge">{selectedCampus}</span>
        </div>

        <div className="admin-campus-tabs">
          {CAMPUSES.map((campus) => (
            <button
              key={campus}
              type="button"
              className={`admin-campus-tab${selectedCampus === campus ? ' active' : ''}`}
              onClick={() => setSelectedCampus(campus)}
            >
              {campus.replace(' CAMPUS', '')}
            </button>
          ))}
        </div>
      </div>

      <div className="admin-password-grid">
        {ROLES.map((role) => {
          const isVisible = visibleRoles[role.value]
          const value = currentValue(role.value)
          return (
            <div key={role.value} className="admin-card admin-password-card">
              <div className="admin-password-head">
                <div className="admin-password-role">
                  <div className="admin-password-role-icon">
                    <role.icon size={20} strokeWidth={2} />
                  </div>
                  <div>
                    <h2>{role.label}</h2>
                    <p>{role.desc}</p>
                  </div>
                </div>
                <span className="admin-password-status">
                  {value ? (
                    <>
                      <span className="admin-status-dot"></span>
                      Set
                    </>
                  ) : (
                    <>
                      <span className="admin-status-dot admin-status-dot-muted"></span>
                      Not set
                    </>
                  )}
                </span>
              </div>

              <div className="admin-password-field">
                <div className="admin-password-input-wrap">
                  <Lock size={16} strokeWidth={2} className="admin-password-lock" />
                  <input
                    type={isVisible ? 'text' : 'password'}
                    value={value}
                    onChange={(e) => handleDraftChange(role.value, e.target.value)}
                    placeholder={`Enter ${role.label} password`}
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    className="admin-password-toggle"
                    onClick={() => toggleVisibility(role.value)}
                    aria-label={isVisible ? 'Hide password' : 'Show password'}
                  >
                    {isVisible ? <EyeOff size={18} strokeWidth={2} /> : <Eye size={18} strokeWidth={2} />}
                  </button>
                </div>
                {draftPasswords[role.value] !== undefined && draftPasswords[role.value].trim() !== value.trim() && (
                  <span className="admin-password-unsaved">Unsaved change</span>
                )}
              </div>

              <button
                type="button"
                className="admin-btn admin-btn-primary admin-btn-block"
                onClick={() => requestConfirm(role.value)}
              >
                Update {role.label} Password
              </button>
            </div>
          )
        })}
      </div>

      {message && (
        <div className="admin-message-bar">
          <CheckCircle2 size={18} strokeWidth={2} />
          {message}
        </div>
      )}

      {confirmTarget && (
        <div className="modal-overlay" onClick={() => setConfirmTarget(null)}>
          <div className="modal admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-confirm-icon">
              <AlertTriangle size={30} strokeWidth={1.75} />
            </div>
            <h3>Confirm password update</h3>
            <p className="modal-subtitle">
              Are you sure you want to update the{' '}
              <strong>{roleLabels[confirmTarget.role]}</strong> password for{' '}
              <strong>{selectedCampus}</strong>?
            </p>
            <p className="modal-subtitle">
              Anyone currently using this role's password for this campus will need the new password.
            </p>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setConfirmTarget(null)}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={savePassword}>
                Confirm Update
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default PasswordManager
