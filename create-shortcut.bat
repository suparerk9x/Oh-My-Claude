@echo off
title Create Desktop Shortcut
echo.
echo Creating desktop shortcut for Oh My Claude...
echo.

powershell -Command "$WshShell = New-Object -ComObject WScript.Shell; $Desktop = [System.Environment]::GetFolderPath('Desktop'); $Shortcut = $WshShell.CreateShortcut(\"$Desktop\Oh My Claude.lnk\"); $Shortcut.TargetPath = '%~dp0start.bat'; $Shortcut.WorkingDirectory = '%~dp0'; $Shortcut.Description = 'Oh My Claude - Real-time Claude Code usage tracker'; $Shortcut.IconLocation = '%%SystemRoot%%\System32\SHELL32.dll,13'; $Shortcut.Save();"

if %errorlevel% == 0 (
    echo.
    echo ========================================
    echo   Shortcut Created Successfully!
    echo ========================================
    echo.
    echo Location: Desktop\Oh My Claude.lnk
    echo Target:   %~dp0start.bat
    echo.
    echo You can now double-click "Oh My Claude"
    echo on your desktop to start the dashboard!
    echo.
) else (
    echo.
    echo ========================================
    echo   Error Creating Shortcut
    echo ========================================
    echo.
    echo Please run this script as Administrator
    echo.
)

echo.
pause
