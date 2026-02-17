@echo off
title Oh My Claude
echo.
echo ========================================
echo   Oh My Claude Dashboard
echo ========================================
echo.
echo Starting servers...
echo.

REM Start backend in new window
start "Backend Server" cmd /k "cd backend && node server.js"

REM Wait 2 seconds for backend to start
timeout /t 2 /nobreak >nul

REM Start frontend in new window
start "Frontend Dev Server" cmd /k "cd frontend && npm run dev -- --port 3001"

REM Wait for frontend to start
timeout /t 3 /nobreak >nul

echo.
echo ========================================
echo   Servers Started!
echo ========================================
echo.
echo Backend:  http://localhost:4000
echo Frontend: http://localhost:3001
echo.
echo Opening browser...
start http://localhost:3001
echo.
echo Press any key to close this window...
pause >nul
