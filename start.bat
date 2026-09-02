@echo off
setlocal

cd /d "%~dp0backend"

if not exist "node_modules" (
  echo [start] Installing dependencies ...
  call npm install || exit /b 1
)

echo [start] Starting EcoKart server on http://localhost:3002
echo [start] (no setup needed - accounts save to backend\data\users.json.
echo [start]  set DATABASE_URL in backend\.env to use Postgres instead.)
echo.
call npm start

endlocal
