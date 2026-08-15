import React from 'react'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info)
  }

  handleReload = () => {
    this.setState({ error: null })
    window.location.reload()
  }

  render() {
    if (this.state.error) {
      return (
        <div className="fullscreen-container role-gate-page">
          <div className="login-wrap">
            <div className="login-header">
              <h1>Something went wrong</h1>
              <p>The page hit an unexpected error and stopped responding.</p>
            </div>
            <div className="alert alert-error login-alert">
              {String(this.state.error.message || this.state.error)}
            </div>
            <button type="button" className="login-button" onClick={this.handleReload}>
              Reload App
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

export default ErrorBoundary
