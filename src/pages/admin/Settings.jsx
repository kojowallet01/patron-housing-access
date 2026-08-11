import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, UserCircle, LogOut, RefreshCw, Info } from 'lucide-react'
import { useAdminContext } from './AdminLayout'
import { logoutSession } from '../../auth'

function Settings() {
  const { activeCampus, isSuperAdmin, refresh } = useAdminContext()
  const navigate = useNavigate()

  const handleLogout = async () => {
    logoutSession()
    navigate('/login')
  }

  return (
    <div className="admin-page-container">
      <div className="admin-page-heading">
        <div>
          <h1 className="admin-page-title">Settings</h1>
          <p className="admin-page-subtitle">App preferences, session, and account details</p>
        </div>
      </div>

      <div className="admin-settings-grid">
        <div className="admin-card admin-settings-card">
          <div className="admin-card-header">
            <div className="admin-card-title">
              <UserCircle size={18} strokeWidth={2} />
              <h2>Session</h2>
            </div>
          </div>
          <div className="admin-settings-row">
            <div>
              <span className="admin-settings-label">Active Campus</span>
              <span className="admin-settings-value">
                <Building2 size={15} strokeWidth={2} />
                {activeCampus}
              </span>
            </div>
            <div>
              <span className="admin-settings-label">Role</span>
              <span className="admin-settings-value">
                {isSuperAdmin ? 'Super Admin' : 'Admin'}
              </span>
            </div>
          </div>
        </div>

        <div className="admin-card admin-settings-card">
          <div className="admin-card-header">
            <div className="admin-card-title">
              <RefreshCw size={18} strokeWidth={2} />
              <h2>Actions</h2>
            </div>
          </div>
          <div className="admin-settings-actions">
            <button type="button" className="admin-btn admin-btn-primary" onClick={refresh}>
              <RefreshCw size={16} strokeWidth={2} />
              Refresh Dashboard Data
            </button>
            {isSuperAdmin && (
              <button
                type="button"
                className="admin-btn admin-btn-secondary"
                onClick={() => navigate('/campus-selector')}
              >
                <Building2 size={16} strokeWidth={2} />
                Switch Campus
              </button>
            )}
            <button type="button" className="admin-btn admin-btn-danger" onClick={handleLogout}>
              <LogOut size={16} strokeWidth={2} />
              Log Out
            </button>
          </div>
        </div>

        <div className="admin-card admin-settings-card">
          <div className="admin-card-header">
            <div className="admin-card-title">
              <Info size={18} strokeWidth={2} />
              <h2>About</h2>
            </div>
          </div>
          <p className="admin-settings-about">
            Patron Housing Access Admin — manage students, visitors, and security access across your
            campuses. Report issues or request features at the front desk.
          </p>
          <span className="admin-settings-version">Version 2.0</span>
        </div>
      </div>
    </div>
  )
}

export default Settings
