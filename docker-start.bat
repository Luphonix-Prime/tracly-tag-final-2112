@echo off
setlocal enabledelayedexpansion

title TraclyTag - Docker Stack Launcher (DB, Backend, Frontend)
color 0A

echo ===============================================================================
echo                TRACLYTAG MULTI-CONTAINER DOCKER STACK
echo                  [DB: PostgreSQL 18] [Backend: Node API] [Frontend: Nginx]
echo ===============================================================================
echo.

cd /d "%~dp0"

:: 1. Verify Docker Engine is running
echo [*] Checking Docker daemon status...
docker info >nul 2>&1
if %errorlevel% neq 0 (
    color 0C
    echo.
    echo [ERROR] Docker is not running!
    echo Please launch Docker Desktop and wait until the engine is fully started.
    echo.
    pause
    exit /b 1
)
echo [OK] Docker daemon is running and ready.
echo.

:: 2. Build and launch all 3 containers
echo [*] Building and starting DB, Backend, and Frontend containers...
echo.
docker compose up --build -d

if %errorlevel% neq 0 (
    color 0C
    echo.
    echo [ERROR] Failed to start Docker Compose services!
    echo Check the error messages above for details.
    echo.
    pause
    exit /b 1
)

:: 3. Wait a few seconds for health probes
echo.
echo [*] Waiting for services to initialize...
timeout /t 5 /nobreak >nul

:: 4. Display running container status
echo.
echo ===============================================================================
echo                        ACTIVE CONTAINERS STATUS
echo ===============================================================================
docker compose ps
echo.

echo ===============================================================================
echo                           ACCESS ENDPOINTS
echo ===============================================================================
echo  - Frontend Web UI:     http://localhost
echo  - Backend API Health:  http://localhost:3000/api/health
echo  - PostgreSQL Database: localhost:5432 (Database: tracelytag, User: tracelytag)
echo ===============================================================================
echo.
echo Containers are running in the background. You can check Docker Desktop!
echo.
echo Press 'L' to follow live logs, or any other key to exit this window.
choice /c LQE /n /t 10 /d E /m "[L=View Logs, E=Exit]: "

if "%errorlevel%"=="1" (
    docker compose logs -f
)

exit /b 0
