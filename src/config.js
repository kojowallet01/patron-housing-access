// API Configuration
// Automatically uses correct API URL based on environment

export const API_URL = import.meta.env.PROD
  ? '/api'  // Production: uses proxy or same origin
  : 'http://localhost:3001/api';

export const CAMPUS_INSTITUTE_NAME = 'CAMPUS INSTITUTE';
export const CAMPUS_LIST = [
  'TESANO CAMPUS',
  'TEMA CAMPUS',
  'MADINA CAMPUS',
  'CHRISTIANSBORG CAMPUS'
];

export const DEFAULT_CAMPUS = import.meta.env.VITE_CAMPUS || 'TESANO CAMPUS';
export const CAMPUS_STORAGE_KEY = 'campus-institute-selected-campus';
export const ADMIN_TOKEN = import.meta.env.VITE_ADMIN_TOKEN || '';
export const SECURITY_TOKEN = import.meta.env.VITE_SECURITY_TOKEN || '';
export const SUPER_ADMIN_TOKEN = import.meta.env.VITE_SUPER_ADMIN_TOKEN || '';

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

const parseTokenMap = (rawValue) => {
  if (!rawValue) return {};

  try {
    const parsed = JSON.parse(rawValue);
    if (parsed && typeof parsed === 'object') {
      return parsed;
    }
  } catch (error) {
    // ignore and fall back to legacy format
  }

  const map = {};
  rawValue.split(',').forEach((entry) => {
    const [campus, token] = String(entry).split(':');
    if (campus && token) {
      map[campus.trim()] = token.trim();
    }
  });
  return map;
};

export const CAMPUS_ADMIN_TOKENS = parseTokenMap(import.meta.env.VITE_CAMPUS_ADMIN_TOKENS || '');
export const CAMPUS_SECURITY_TOKENS = parseTokenMap(import.meta.env.VITE_CAMPUS_SECURITY_TOKENS || '');

export function getCampusAuthHeaders(type = 'admin') {
  const campus = getSelectedCampus();
  const headers = { 'x-campus': campus };

  if (SUPER_ADMIN_TOKEN) {
    headers['x-super-admin-token'] = SUPER_ADMIN_TOKEN;
    return headers;
  }

  if (type === 'admin') {
    const token = CAMPUS_ADMIN_TOKENS[campus] || ADMIN_TOKEN;
    if (token) headers['x-admin-token'] = token;
  } else {
    const token = CAMPUS_SECURITY_TOKENS[campus] || SECURITY_TOKEN;
    if (token) headers['x-security-token'] = token;
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
  ADMIN_TOKEN,
  SECURITY_TOKEN,
  SUPER_ADMIN_TOKEN,
  CAMPUS_ADMIN_TOKENS,
  CAMPUS_SECURITY_TOKENS,
  getCampusAuthHeaders,
  getBaseURL,
  // Add other configuration as needed
  autoRefreshInterval: 30000, // 30 seconds
  adminRefreshInterval: 5000, // 5 seconds
};

export default config;
