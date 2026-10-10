@echo off
setlocal enabledelayedexpansion

echo ========================================================
echo        TraclyTag PostgreSQL Atomic Backup Snapshot
echo ========================================================

cd /d "%~dp0"

if not exist "backups" mkdir backups

:: Extract or set default environment variables
set "POSTGRES_USER=tracelytag"
set "POSTGRES_DB=tracelytag"

for /f "tokens=1,2 delims==" %%A in (.env) do (
    if "%%A"=="POSTGRES_USER" set "POSTGRES_USER=%%B"
    if "%%A"=="POSTGRES_DB" set "POSTGRES_DB=%%B"
)

:: Generate timestamp
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value 2^>nul') do set "dt=%%I"
if not defined dt (
    set "ts=%date:~10,4%%date:~4,2%%date:~7,2%_%time:~0,2%%time:~3,2%%time:~6,2%"
    set "ts=!ts: =0!"
) else (
    set "ts=%dt:~0,4%%dt:~4,2%%dt:~6,2%_%dt:~8,2%%dt:~10,2%%dt:~12,2%"
)

set "BACKUP_FILE=backups\tracelytag_%ts%.backup"
set "CHECKSUM_FILE=backups\tracelytag_%ts%.backup.sha256"

echo [*] Pausing application container to prevent split-brain writes...
docker compose stop app 2>nul

echo [*] Executing pg_dump inside db container...
docker compose exec -T db pg_dump --username="%POSTGRES_USER%" --dbname="%POSTGRES_DB%" --format=custom --no-owner --no-privileges > "%BACKUP_FILE%"

if %errorlevel% neq 0 (
    echo [ERROR] Backup dump failed!
    docker compose start app 2>nul
    pause
    exit /b 1
)

echo [*] Generating SHA256 checksum...
certutil -hashfile "%BACKUP_FILE%" SHA256 > "%CHECKSUM_FILE%"

echo [*] Restarting application container...
docker compose start app 2>nul

echo ========================================================
echo [SUCCESS] Database backup created: %BACKUP_FILE%
echo [SUCCESS] SHA256 checksum stored:  %CHECKSUM_FILE%
echo ========================================================
pause
