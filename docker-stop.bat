@echo off
setlocal enabledelayedexpansion

title TraclyTag - Stop Docker Stack
color 0E

echo ===============================================================================
echo                TRACLYTAG DOCKER STACK SHUTDOWN
echo ===============================================================================
echo.

cd /d "%~dp0"

echo [*] Stopping and removing containers (preserving database volume)...
docker compose down

if %errorlevel% neq 0 (
    echo [ERROR] Failed to stop containers cleanly.
    pause
    exit /b 1
)

echo.
echo ===============================================================================
echo [SUCCESS] All containers stopped. Your PostgreSQL volume remains safe.
echo ===============================================================================
timeout /t 3 /nobreak >nul
exit /b 0
