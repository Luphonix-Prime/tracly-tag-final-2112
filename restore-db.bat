@echo off
setlocal enabledelayedexpansion

echo ========================================================
echo        TraclyTag PostgreSQL Guarded Recovery Script
echo ========================================================

cd /d "%~dp0"

set "BACKUP_FILE=%~1"
if "%BACKUP_FILE%"=="" (
    echo Usage: restore-db.bat path\to\backup_file.backup
    echo Available backups:
    dir /b backups\*.backup 2>nul
    echo.
    set /p "BACKUP_FILE=Enter backup filename (from backups folder): "
    if not exist "!BACKUP_FILE!" (
        if exist "backups\!BACKUP_FILE!" set "BACKUP_FILE=backups\!BACKUP_FILE!"
    )
)

if not exist "%BACKUP_FILE%" (
    echo [ERROR] Backup file '%BACKUP_FILE%' does not exist!
    pause
    exit /b 1
)

echo [!] WARNING: This will DROP and RECREATE the database!
echo [!] All existing database data will be overwritten.
set /p "CONFIRM=Type RESTORE to confirm: "
if not "%CONFIRM%"=="RESTORE" (
    echo [ABORT] Recovery cancelled by user.
    pause
    exit /b 0
)

:: Extract environment variables
set "POSTGRES_USER=tracelytag"
set "POSTGRES_DB=tracelytag"

for /f "tokens=1,2 delims==" %%A in (.env) do (
    if "%%A"=="POSTGRES_USER" set "POSTGRES_USER=%%B"
    if "%%A"=="POSTGRES_DB" set "POSTGRES_DB=%%B"
)

echo [*] Starting db container if not running...
docker compose up -d --wait db

echo [*] Stopping app container during restoration...
docker compose stop app 2>nul

echo [*] Re-creating database inside container...
docker compose exec -T db dropdb --if-exists --username="%POSTGRES_USER%" "%POSTGRES_DB%"
docker compose exec -T db createdb --username="%POSTGRES_USER%" "%POSTGRES_DB%"

echo [*] Restoring database snapshot via pg_restore...
docker compose exec -T db pg_restore --username="%POSTGRES_USER%" --dbname="%POSTGRES_DB%" --exit-on-error --no-owner --no-privileges < "%BACKUP_FILE%"

echo [*] Restarting application container...
docker compose start app

echo ========================================================
echo [SUCCESS] Database restored successfully from %BACKUP_FILE%
echo ========================================================
pause
