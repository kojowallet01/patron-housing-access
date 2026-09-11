import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CAMPUS_INSTITUTE_NAME,
  CAMPUS_LIST,
  CAMPUS_COLORS,
  getSelectedCampus,
  setSelectedCampus
} from '../config'
import { validateSession } from '../auth'
import CampusLogo from '../components/CampusLogo'

function CampusSelector() {
  const navigate = useNavigate()
  const [selectedCampus, setSelected] = useState(getSelectedCampus())

  useEffect(() => {
    let active = true

    validateSession().then((session) => {
      if (!active) return
      if (session.valid && !session.isSuperAdmin) {
        navigate('/admin')
      }
    })

    return () => {
      active = false
    }
  }, [navigate])

  const handleSelect = (campus) => {
    setSelected(campus)
    setSelectedCampus(campus)
    navigate('/admin')
  }

  return (
    <div className="fullscreen-container home-page">
      <div className="home-header">
        <h1>🏛️ {CAMPUS_INSTITUTE_NAME}</h1>
        <p>Select campus workspace</p>
      </div>

      <div className="home-content">
        <div className="page-grid campus-picker-grid">
          {CAMPUS_LIST.map((campus) => (
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
              <h3>{campus}</h3>
              <p>Open admin and security dashboard for this campus</p>
              <div className="page-url">
                {selectedCampus === campus ? 'Current selection' : 'Switch to this campus'}
              </div>
              <button className="page-btn">{selectedCampus === campus ? 'Selected' : 'Select'}</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default CampusSelector
