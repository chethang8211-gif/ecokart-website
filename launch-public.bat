@echo off
title EcoKart - Live Public Host
color 0A

echo ===================================================
echo           🌿 ECOKART PUBLIC LAUNCHER 🌿
echo ===================================================
echo.

cd /d "%~dp0"

echo [1/3] Checking dependencies...
if not exist "backend\node_modules" (
    echo Installing backend dependencies...
    cd backend
    call npm install
    if errorlevel 1 goto :error
    cd ..
)

echo [2/3] Starting EcoKart Backend Server on port 3002...
start "EcoKart Backend" /min cmd /c "cd /d "%~dp0backend" && node server.js"

timeout /t 3 /nobreak >nul

echo [3/3] Creating Live Public Tunnel via Cloudflare...
echo.
echo ===================================================
echo  Your live shareable link will appear below!
echo  Copy the "https://....trycloudflare.com" link
echo  and send it to anyone to explore and give feedback.
echo ===================================================
echo.

if exist "%~dp0cloudflared.exe" (
    "%~dp0cloudflared.exe" tunnel --url http://localhost:3002
) else if exist "%~dp0..\cloudflared.exe" (
    "%~dp0..\cloudflared.exe" tunnel --url http://localhost:3002
) else (
    echo cloudflared.exe not found, falling back to SSH tunnel...
    ssh -o StrictHostKeyChecking=no -R 80:localhost:3002 nokey@localhost.run
)

goto :eof

:error
echo.
echo [ERROR] Failed to start EcoKart.
pause
