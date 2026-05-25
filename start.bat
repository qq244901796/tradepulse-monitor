@echo off
setlocal

set "ROOT=%~dp0"
set "BUNDLED_NODE=%ROOT%node\node.exe"

if exist "%BUNDLED_NODE%" (
  set "NODE_CMD=%BUNDLED_NODE%"
) else (
  set "NODE_CMD=node"
)

start "" powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 2; Start-Process 'http://127.0.0.1:14587'"
"%NODE_CMD%" "%ROOT%src\server.js"

if errorlevel 1 (
  echo.
  echo TradePulse Monitor failed to start.
  echo If this package does not include node\node.exe, install Node.js 22+ or add bundled Node.
  pause
)
