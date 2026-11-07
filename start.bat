@echo off
setlocal
cd /d "%~dp0"

if not exist "node_modules" (
    echo [PDF Cutter] node_modules not found, running npm install first...
    call npm install
    if errorlevel 1 (
        echo.
        echo npm install failed. See the output above for details.
        pause
        exit /b 1
    )
)

echo.
echo [PDF Cutter] Starting dev server. Your browser will open automatically once it's ready...
echo Press Ctrl+C in this window to stop the server.
echo.

call npm run dev -- --open

echo.
echo Server stopped.
pause
