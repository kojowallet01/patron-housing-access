@echo off
cls
echo.
echo ╔═══════════════════════════════════════════════════════════════════╗
echo ║           AIFSP - Starting Server with New Passwords              ║
echo ╚═══════════════════════════════════════════════════════════════════╝
echo.
echo [*] Loading environment variables from .env file...
echo [*] Starting development server...
echo.
echo ┌───────────────────────────────────────────────────────────────────┐
echo │                      QUICK ACCESS URLs                            │
echo ├───────────────────────────────────────────────────────────────────┤
echo │ Frontend:         http://localhost:3000                           │
echo │ Admin Login:      http://localhost:3000/admin/login               │
echo │ Security Portal:  http://localhost:3000/security                  │
echo │ API Backend:      http://localhost:3001/api                       │
echo └───────────────────────────────────────────────────────────────────┘
echo.
echo [✓] Super Admin Password: REPLACE_WITH_UNIQUE_SUPER_ADMIN_SECRET
echo [✓] Check QUICK_LOGIN_GUIDE.txt for all campus passwords
echo.
echo [*] Press Ctrl+C to stop the server
echo ═══════════════════════════════════════════════════════════════════
echo.

npm run dev
