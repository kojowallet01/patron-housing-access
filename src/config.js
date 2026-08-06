// API Configuration
// Automatically uses correct API URL based on environment

export const API_URL = import.meta.env.PROD 
  ? '/api'  // Production: uses proxy or same origin
  : 'http://localhost:3001/api';

// Get base URL for QR code generation
export const getBaseURL = () => {
  if (import.meta.env.PROD) {
    return window.location.origin;
  }
  return 'http://localhost:3000';
};

export const config = {
  API_URL,
  getBaseURL,
  // Add other configuration as needed
  autoRefreshInterval: 30000, // 30 seconds
  adminRefreshInterval: 5000, // 5 seconds
};

export default config;
