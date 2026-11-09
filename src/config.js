// API Configuration
// Automatically uses correct API URL based on environment

const IS_PRODUCTION_BUILD = import.meta.env.MODE === 'production'

export const API_URL = '/api'

export const CAMPUS_INSTITUTE_NAME = 'ACCRA INSTITUTE FACULTY STUDENT PORTAL';
export const CAMPUS_INSTITUTE_SHORT = 'AIFSP';
export const CAMPUS_LIST = [
  'TESANO CAMPUS',
  'CANTOMENT CAMPUS',
  'ASHIAMAN CAMPUS',
  'LEGON CAMPUS',
  'TEMA CAMPUS'
];

export const ALL_CAMPUSES = 'ALL CAMPUSES';
export const ADMIN_CAMPUS_OPTIONS = [
  ALL_CAMPUSES,
  ...CAMPUS_LIST
];

export const CAMPUS_COLORS = {
  'ALL CAMPUSES': '#4f46e5',
  'TESANO CAMPUS': '#2563eb',
  'CANTOMENT CAMPUS': '#ec4899',
  'ASHIAMAN CAMPUS': '#dc2626',
  'LEGON CAMPUS': '#16a34a',
  'TEMA CAMPUS': '#f59e0b'
};

export const DEFAULT_CAMPUS = import.meta.env.VITE_CAMPUS || 'TESANO CAMPUS';
export const CAMPUS_STORAGE_KEY = 'campus-institute-selected-campus';

export function getSelectedCampus() {
  if (typeof window === 'undefined') return DEFAULT_CAMPUS;

  const saved = window.localStorage.getItem(CAMPUS_STORAGE_KEY);
  if (saved && (CAMPUS_LIST.includes(saved) || saved === ALL_CAMPUSES)) {
    return saved;
  }

  window.localStorage.setItem(CAMPUS_STORAGE_KEY, DEFAULT_CAMPUS);
  return DEFAULT_CAMPUS;
}

export function setSelectedCampus(campus) {
  if (typeof window === 'undefined') return;

  const nextCampus = (CAMPUS_LIST.includes(campus) || campus === ALL_CAMPUSES) ? campus : DEFAULT_CAMPUS;
  window.localStorage.setItem(CAMPUS_STORAGE_KEY, nextCampus);
}

export function getCampusAuthHeaders(campusOverride) {
  const campus = campusOverride || getSelectedCampus();
  return { 'x-campus': campus };
}

// Get base URL for QR code generation
export const getBaseURL = () => {
  if (IS_PRODUCTION_BUILD) {
    return window.location.origin;
  }
  return 'http://localhost:3000';
};

export const config = {
  API_URL,
  CAMPUS_INSTITUTE_NAME,
  CAMPUS_INSTITUTE_SHORT,
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
