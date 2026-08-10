# CAMPUS INSTITUTE ACCESS SYSTEM - Project Summary

## Overview
This project is a multi-campus access and visitor management system for CAMPUS INSTITUTE with campus-specific admin and security control.

## Campus structure
The current campus set is:
- TESANO CAMPUS
- CHRISTIANSBORG CAMPUS
- ASHIAMAN CAMPUS
- LEGON CAMPUS

Each campus has its own login and access flow, and the selected campus is preserved in browser storage.

## Current features
- Multi-campus branding and routing
- Campus-specific admin and security access pages
- Single combined login form with:
  - role selection
  - campus selection
  - password input
- Super-admin access for campus password assignment
- Campus password manager for assigning admin and security passwords
- QR-based registration and access token flow
- Admin dashboard with stats, student lists, and recent activity
- Security verification for tokens
- CSV/report style access summaries and campus-specific reporting

## Key routes
- Entrance: http://localhost:3007/
- Admin: http://localhost:3007/admin
- Security: http://localhost:3007/security
- Registration: http://localhost:3007/register

## Important implementation notes
- The app supports campus-aware authentication headers.
- The backend validates admin and security login against campus-specific stored tokens or environment values.
- Super-admin access can be used to manage campus credentials.
- Port fallback logic prevents crashes when common dev ports are occupied.

## Key files
- src/App.jsx
- src/config.js
- src/pages/RoleGate.jsx
- src/pages/Entrance.jsx
- src/pages/admin/Admin.jsx
- server/index.js
- CURRENT_WORK_SUMMARY.md
- PROJECT_SUMMARY.md

## Verification
The project was validated with:
- npm run build

This completed successfully in the latest run.

## Git status
The project has been committed and pushed to the GitHub repository.
