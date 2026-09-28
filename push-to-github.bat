@echo off
title EcoKart - Push to GitHub
color 0A

echo ===================================================
echo        🌿 PUSHING ECOKART UPDATES TO GITHUB 🌿
echo ===================================================
echo.

cd /d "%~dp0"

set "GIT_EXE=C:\Users\cheth\AppData\Local\GitHubDesktop\app-3.6.6\resources\app\git\cmd\git.exe"

echo [1/2] Checking committed changes...
"%GIT_EXE%" add -A
"%GIT_EXE%" commit -m "Update EcoKart: feedback system, public exploration, demo login" 2>nul

echo.
echo [2/2] Pushing to GitHub (origin main)...
echo.
"%GIT_EXE%" push origin main

if %errorlevel% equ 0 (
    echo.
    echo ===================================================
    echo  SUCCESS! Pushed to GitHub successfully!
    echo  Render and Netlify will automatically update!
    echo ===================================================
) else (
    echo.
    echo [NOTE] If Git asks for credentials, log in.
    echo Or open GitHub Desktop and click 'Push origin'.
)

echo.
pause
