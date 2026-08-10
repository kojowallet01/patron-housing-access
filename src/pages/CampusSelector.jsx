import React, { useState } from 'react'
import { CAMPUS_INSTITUTE_NAME, CAMPUS_LIST, getSelectedCampus, setSelectedCampus } from '../config'

function CampusSelector() {
  const [selectedCampus, setSelected] = useState(getSelectedCampus())

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
        <div className="page-grid">
          {CAMPUS_LIST.map((campus) => (
            <div
              key={campus}
              className={`page-card ${selectedCampus === campus ? 'selected-campus' : ''}`}
              onClick={() => handleSelect(campus)}
            >
              <div className="page-icon">📍</div>
              <h3>{campus}</h3>
              <p>Open admin and security dashboard for this campus</p>
              <div className="page-url">{selectedCampus === campus ? 'Current selection' : 'Switch to this campus'}</div>
              <button className="page-btn">{selectedCampus === campus ? 'Selected' : 'Select'}</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default CampusSelector
