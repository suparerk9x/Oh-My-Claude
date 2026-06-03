@echo off
title Oh My Claude
cd /d "%~dp0"
echo.
echo ========================================
echo   Oh My Claude Dashboard (PM2 - single port 4825)
echo ========================================
echo.

REM PM2 dedupes by app name, so running this twice will NOT create a duplicate backend.
call pm2 start backend\ecosystem.config.cjs
call pm2 save

timeout /t 2 /nobreak >nul
start http://localhost:4825

echo.
echo Dashboard: http://localhost:4825   (UI + API + WS, PM2-managed)
echo.
echo   pm2 logs omc-backend       view logs
echo   pm2 restart omc-backend    restart after a code change
echo   pm2 monit                  live CPU/mem monitor
echo   pm2 stop omc-backend       stop
echo.
echo NOTE: after editing the frontend, rebuild it:  cd frontend ^&^& npm run build
echo       (then pm2 restart omc-backend to serve the new build)
echo.
pause >nul
