import { useState, useEffect } from 'react'
import {
  CAMPUS_INSTITUTE_NAME,
  ADMIN_CAMPUS_OPTIONS,
  ALL_CAMPUSES,
  CAMPUS_COLORS,
  getSelectedCampus,
  setSelectedCampus
} from '../config'
import { validateSession } from '../auth'
import CampusLogo from '../components/CampusLogo'

function CampusSelector() {
  const [selectedCampus, setSelected] = useState(getSelectedCampus())

  useEffect(() => {
    let active = true

    validateSession().then((session) => {
      if (!active) return
      if (session.valid && !session.isSuperAdmin) {
        window.location.href = '/admin'
      }
    })

    return () => {
      active = false
    }
  }, [])

  const handleSelect = (campus) => {
    setSelected(campus)
    setSelectedCampus(campus)
    window.location.href = '/admin'
  }

  return (
    <div className="fullscreen-container home-page">
      <div className="home-header">
        <h1>🏛️ {CAMPUS_INSTITUTE_NAME}</h1>
        <p>Select campus workspace</p>
      </div>

      <div className="home-content">
        <div className="page-grid campus-picker-grid">
          {ADMIN_CAMPUS_OPTIONS.map((campus) => {
            const isAll = campus === ALL_CAMPUSES
            return (
              <div
                key={campus}
                className={`page-card campus-picker-card ${selectedCampus === campus ? 'selected-campus' : ''}`}
                style={{
                  background: '#ffffff',
                  color: '#1f2937',
                  borderColor: selectedCampus === campus ? (CAMPUS_COLORS[campus] || '#28a745') : 'transparent'
                }}
                onClick={() => handleSelect(campus)}
              >
                <div className="page-icon campus-picker-logo">
                  <CampusLogo campus={campus} />
                </div>
                <h3>{isAll ? '🌐 ALL CAMPUSES' : campus}</h3>
                <p>
                  {isAll
                    ? 'Consolidated overview of visits and student statistics across all campus branches'
                    : 'Open admin and security dashboard for this campus'}
                </p>
                <div className="page-url">
                  {selectedCampus === campus ? 'Current selection' : isAll ? 'Switch to network overview' : 'Switch to this campus'}
                </div>
                <button className="page-btn">{selectedCampus === campus ? 'Selected' : 'Select'}</button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default CampusSelector
