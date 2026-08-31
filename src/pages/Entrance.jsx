import { useNavigate } from 'react-router-dom'
import { CAMPUS_INSTITUTE_NAME, CAMPUS_LIST, setSelectedCampus } from '../config'
import CampusLogo from '../components/CampusLogo'

function Entrance() {
  const navigate = useNavigate()

  const handleCampusSelect = (campus) => {
    setSelectedCampus(campus)
    navigate(`/access?campus=${encodeURIComponent(campus)}`)
  }

  return (
    <div className="fullscreen-container role-gate-page">
      <div className="login-wrap">
        <header className="login-header">
          <img src="/logo.png" alt="AIFSP" className="login-logo" />
          <h1>{CAMPUS_INSTITUTE_NAME}</h1>
          <p>Select your campus to get access</p>
        </header>

        <div className="campus-row">
          {CAMPUS_LIST.map((campus) => (
            <button
              key={campus}
              type="button"
              onClick={() => handleCampusSelect(campus)}
              className="campus-box entrance-campus-box"
              style={{
                background: '#ffffff',
                color: '#111827',
                borderColor: '#d1d5db',
                boxShadow: '0 2px 6px rgba(0, 0, 0, 0.06)'
              }}
            >
              <span className="campus-box-content">
                <span className="campus-box-logo">
                  <CampusLogo campus={campus} />
                </span>
                <span className="campus-box-label">{campus.replace(' CAMPUS', '')}</span>
              </span>
            </button>
          ))}
        </div>

        <p className="entrance-hint">You will see the building access QR code after choosing your campus.</p>
      </div>
    </div>
  )
}

export default Entrance
