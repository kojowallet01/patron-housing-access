import React, { useState, useEffect } from 'react'

function EntranceQR() {
  const [qrCode, setQrCode] = useState(null)
  const [registrationUrl, setRegistrationUrl] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchQRCode()
  }, [])

  const fetchQRCode = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/campus-qr')
      const data = await response.json()
      
      // Create registration URL with campus code
      const baseUrl = window.location.origin
      const regUrl = `${baseUrl}?campus=${data.code}`
      
      setRegistrationUrl(regUrl)
      setQrCode(data)
    } catch (error) {
      console.error('Error fetching QR code:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="card loading">Loading entrance QR code...</div>
  }

  return (
    <div className="card">
      <div className="qr-display">
        <h2>🚪 Campus Entrance</h2>
        <p style={{ color: '#666', marginBottom: '30px', fontSize: '1.1rem' }}>
          Display this QR code at the entrance
        </p>
        
        <div style={{ 
          background: '#f8f9fa', 
          padding: '30px', 
          borderRadius: '12px',
          border: '3px dashed #667eea'
        }}>
          {qrCode && (
            <>
              <img 
                src={qrCode.qrCodeUrl || qrCode.qrCode} 
                alt="Campus Entrance QR Code" 
                style={{ maxWidth: '350px' }}
              />
              <div style={{ 
                marginTop: '20px', 
                padding: '15px',
                background: 'white',
                borderRadius: '8px'
              }}>
                <p style={{ fontSize: '1rem', fontWeight: '600', color: '#667eea', marginBottom: '10px' }}>
                  📱 Instructions for Students:
                </p>
                <ol style={{ textAlign: 'left', color: '#666', lineHeight: '1.8' }}>
                  <li>Scan this QR code with your phone camera</li>
                  <li>Fill out the registration form</li>
                  <li>Receive your access token immediately</li>
                  <li>Show token to security to enter</li>
                </ol>
              </div>
            </>
          )}
        </div>

        <div style={{ 
          marginTop: '20px', 
          fontSize: '0.85rem', 
          color: '#999',
          padding: '10px',
          background: '#f8f9fa',
          borderRadius: '6px'
        }}>
          <p>QR Code URL: <code style={{ fontSize: '0.75rem' }}>{registrationUrl}</code></p>
        </div>
      </div>
    </div>
  )
}

export default EntranceQR
