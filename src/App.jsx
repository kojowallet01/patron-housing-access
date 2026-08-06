import React from 'react'
import Entrance from './pages/Entrance'
import RegisterPage from './pages/RegisterPage'
import Security from './pages/Security'
import Admin from './pages/Admin'

function App() {
  const path = window.location.pathname
  const hasRegisterParam = window.location.search.includes('campus=')

  if (path === '/register' || hasRegisterParam) {
    return <RegisterPage />
  }

  if (path === '/security') {
    return <Security />
  }

  if (path === '/admin') {
    return <Admin />
  }

  if (path === '/entrance' || path === '/') {
    return <Entrance />
  }

  return <Entrance />
}

export default App
