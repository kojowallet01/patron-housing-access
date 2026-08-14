# AIFSP - Current Work Summary

## Project status
This project now includes the AIFSP multi-campus access flow with role-based login and campus-aware access control.

## Included features
- Multi-campus branding for: TESANO CAMPUS, CANTOMENT CAMPUS, ASHIAMAN CAMPUS, LEGON CAMPUS, TEMA CAMPUS
- Combined login screen with:
  - role selection
  - campus selection
  - password entry
- Campus-aware admin and security dashboard access
- Selected campus persistence in browser local storage
- QR registration and verification flow tied to the selected campus
- Admin/security route protection

## Key app routes
- Entrance: http://localhost:3000/
- Admin: http://localhost:3000/admin
- Security: http://localhost:3000/security

## Important notes
- The app was configured to avoid port conflicts by using the next available local ports in this environment.
- The backend API is available on http://localhost:3001
- Real deployment credentials should be set in environment variables before production use.

## Main files changed
- src/App.jsx
- src/pages/RoleGate.jsx
- src/pages/Entrance.jsx
- src/config.js
- server/index.js

## Build verification
The project was verified with:
- npm run build

This passed successfully.
