import { API_URL, CAMPUS_STORAGE_KEY } from './config'

export const SESSION_KEY = 'campus-institute-session'
export const ROLE_KEY = 'campus-institute-role'

export function setSession(role, campus) {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(SESSION_KEY)
  window.localStorage.setItem(ROLE_KEY, role)
  if (campus) {
    window.localStorage.setItem(CAMPUS_STORAGE_KEY, campus)
  }
}

export function clearSession() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(SESSION_KEY)
  window.localStorage.removeItem(ROLE_KEY)
}

export function getStoredRole() {
  if (typeof window === 'undefined') return ''
  return window.localStorage.getItem(ROLE_KEY) || ''
}

export async function validateSession() {
  try {
    const response = await fetch(`${API_URL}/session`, {
      credentials: 'include'
    })
    if (!response.ok) {
      clearSession()
      return { valid: false }
    }
    return response.json()
  } catch {
    return { valid: false }
  }
}

export async function logoutSession() {
  try {
    await fetch(`${API_URL}/logout`, {
      method: 'POST',
      credentials: 'include'
    })
  } catch {
    // Local role state is cleared even when the server cannot be reached.
  }
  clearSession()
}

export function installAuthInterceptor() {
  const originalFetch = window.fetch
  window.fetch = async (...args) => {
    const [input, init = {}] = args
    const response = await originalFetch(input, {
      ...init,
      credentials: init.credentials || 'include'
    })
    if (response.status === 401) {
      const url = typeof input === 'string' ? input : input?.url || ''
      if (url.includes('/api/') && getStoredRole()) {
        clearSession()
        window.location.href = '/'
      }
    }
    return response
  }
}
