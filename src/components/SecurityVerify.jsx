import React, { useState } from 'react'

function SecurityVerify() {
  const [token, setToken] = useState('')
  const [result, setResult] = useState(null)
  const [verifying, setVerifying] = useState(false)

  const handleVerify = async () => {
    if (!token) {
      setResult({ valid: false, error: 'Please enter a token' })
      return
    }

    setVerifying(true)
    setResult(null)

    try {
      const response = await fetch('http://localhost:3001/api/verify-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token.trim() })
      })

      const data = await response.json()
      setResult(data)
    } catch (error) {
      setResult({ valid: false, error: 'Network error' })
    } finally {
      setVerifying(false)
    }
  }

  const handleReset = () => {
    setToken('')
    setResult(null)
  }

  return (
    <div className="card">
      <h2>🔒 Security Verification</h2>
      <p style={{ color: '#666', marginBottom: '20px' }}>
        Scan or enter student's access token to verify entry
      </p>

      {!result ? (
        <div>
          <div className="form-group">
            <label>Access Token</label>
            <input
              type="text"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Enter or scan the token"
            />
          </div>
          <button 
            className="btn btn-primary" 
            onClick={handleVerify}
            disabled={verifying}
          >
            {verifying ? 'Verifying...' : 'Verify Token'}
          </button>
        </div>
      ) : (
        <div>
          {result.valid ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '4rem', marginBottom: '20px' }}>✅</div>
              <h3 style={{ color: '#28a745', marginBottom: '20px' }}>Access Granted</h3>
              
              <div style={{ background: '#d4edda', padding: '20px', borderRadius: '8px', textAlign: 'left' }}>
                <p><strong>Name:</strong> {result.student.name}</p>
                <p><strong>Email:</strong> {result.student.email}</p>
                {result.student.home_campus && (
                  <p><strong>Home Campus:</strong> {result.student.home_campus}</p>
                )}
                <p><strong>Valid Date:</strong> {result.validDate}</p>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '4rem', marginBottom: '20px' }}>❌</div>
              <h3 style={{ color: '#dc3545', marginBottom: '20px' }}>Access Denied</h3>
              <div className="alert alert-error">
                {result.error || 'Invalid or expired token'}
              </div>
            </div>
          )}
          
          <button 
            className="btn btn-secondary" 
            onClick={handleReset}
            style={{ marginTop: '20px' }}
          >
            Verify Another Token
          </button>
        </div>
      )}
    </div>
  )
}

export default SecurityVerify
