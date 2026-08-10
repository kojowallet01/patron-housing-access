import { API_URL, CAMPUS_STORAGE_KEY } from './config'

export const SESSION_KEY = 'campus-institute-session'
export const ROLE_KEY = 'campus-institute-role'

export function getSessionToken() {
  if (typeof window === 'undefined') return ''
  return window.localStorage.getItem(SESSION_KEY) || ''
}

export function setSession(token, role, campus) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(SESSION_KEY, token)
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
  const sessionToken = getSessionToken()
  if (!sessionToken) {
    return { valid: false }
  }

  try {
    const response = await fetch(`${API_URL}/session`, {
      headers: { 'x-session-token': sessionToken }
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
  const sessionToken = getSessionToken()
  if (sessionToken) {
    try {
      await fetch(`${API_URL}/logout`, {
        method: 'POST',
        headers: { 'x-session-token': sessionToken }
      })
    } catch {
      // ignore network errors during logout
    }
  }
  clearSession()
}
