@echo off
echo.
echo ========================================
echo  Tesano Campus Sign-In System
echo  Starting Network Server...
echo ========================================
echo.
echo Finding your network IP address...
echo.

for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4 Address"') do (
    set IP=%%a
    set IP=!IP: =!
    echo Found IP: !IP!
    echo.
    echo ========================================
    echo  IMPORTANT - Use This Address:
    echo ========================================
    echo.
    echo  On entrance display, open:
    echo  http://!IP!:3000/
    echo.
    echo  On security tablet, open:
    echo  http://!IP!:3000/security
    echo.
    echo  On admin computer, open:
    echo  http://!IP!:3000/admin
    echo.
    echo ========================================
    echo.
    goto :found
)

:found
echo Starting server...
echo.
npm run dev
