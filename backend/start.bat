@echo off
title Oh-My-Claude Backend
:loop
echo [%date% %time%] Starting server...
node --max-old-space-size=512 server.js
echo [%date% %time%] Server exited with code %errorlevel%. Restarting in 2 seconds...
timeout /t 2 /nobreak >nul
goto loop
