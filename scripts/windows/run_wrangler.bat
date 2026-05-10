@echo off
set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%..\.."
echo [%DATE% %TIME%] Starting Wrangler Pages Dev Server in %CD% >> "%SCRIPT_DIR%wrangler.log"
call npx -y wrangler pages dev . --ip 0.0.0.0 --live-reload --show-interactive-dev-session false >> "%SCRIPT_DIR%wrangler.log" 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [%DATE% %TIME%] Error: Wrangler failed to start (Code: %ERRORLEVEL%). >> "%SCRIPT_DIR%wrangler.log"
)
