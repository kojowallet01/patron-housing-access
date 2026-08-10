// API Configuration
// Automatically uses correct API URL based on environment

export const API_URL = import.meta.env.PROD
  ? '/api'  // Production: uses proxy or same origin
  : `${window.location.protocol}//${window.location.hostname}:3001/api`;

export const CAMPUS_INSTITUTE_NAME = 'CAMPUS INSTITUTE';
export const CAMPUS_LIST = [
  'TESANO CAMPUS',
  'CHRISTIANSBORG CAMPUS',
  'ASHIAMAN CAMPUS',
  'LEGON CAMPUS'
];

export const CAMPUS_COLORS = {
  'TESANO CAMPUS': '#2563eb',
  'CHRISTIANSBORG CAMPUS': '#ec4899',
  'ASHIAMAN CAMPUS': '#dc2626',
  'LEGON CAMPUS': '#16a34a'
};

export const DEFAULT_CAMPUS = import.meta.env.VITE_CAMPUS || 'TESANO CAMPUS';
export const CAMPUS_STORAGE_KEY = 'campus-institute-selected-campus';

export function getSelectedCampus() {
  if (typeof window === 'undefined') return DEFAULT_CAMPUS;

  const saved = window.localStorage.getItem(CAMPUS_STORAGE_KEY);
  if (saved && CAMPUS_LIST.includes(saved)) {
    return saved;
  }

  window.localStorage.setItem(CAMPUS_STORAGE_KEY, DEFAULT_CAMPUS);
  return DEFAULT_CAMPUS;
}

export function setSelectedCampus(campus) {
  if (typeof window === 'undefined') return;

  const nextCampus = CAMPUS_LIST.includes(campus) ? campus : DEFAULT_CAMPUS;
  window.localStorage.setItem(CAMPUS_STORAGE_KEY, nextCampus);
}

export function getCampusAuthHeaders() {
  const campus = getSelectedCampus();
  const headers = { 'x-campus': campus };

  if (typeof window !== 'undefined') {
    const sessionToken = window.localStorage.getItem('campus-institute-session');
    if (sessionToken) {
      headers['x-session-token'] = sessionToken;
    }
  }

  return headers;
}

// Get base URL for QR code generation
export const getBaseURL = () => {
  if (import.meta.env.PROD) {
    return window.location.origin;
  }
  return 'http://localhost:3000';
};

export const config = {
  API_URL,
  CAMPUS_INSTITUTE_NAME,
  CAMPUS_LIST,
  DEFAULT_CAMPUS,
  getSelectedCampus,
  setSelectedCampus,
  getCampusAuthHeaders,
  getBaseURL,
  // Add other configuration as needed
  autoRefreshInterval: 30000, // 30 seconds
  adminRefreshInterval: 5000, // 5 seconds
};

export default config;
