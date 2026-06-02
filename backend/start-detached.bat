@echo off
title Oh-My-Claude Backend (Auto-Restart)
cd /d "%~dp0"

:loop
echo [%date% %time%] Starting server...
start /wait /b node --max-old-space-size=512 server.js
echo [%date% %time%] Server exited with code %errorlevel%. Restarting in 2s...
timeout /t 2 /nobreak >nul
goto loop
