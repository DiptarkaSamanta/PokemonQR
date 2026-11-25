@echo off
setlocal
cd /d "%~dp0"
title PokeQR Studio

where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js was not found in PATH. Please install Node.js 20+ and try again.
    pause
    exit /b 1
)

set "MODE=prod"
set "FORCE_BUILD=0"
set "OPEN_BROWSER=1"
if not defined PORT set "PORT=3000"

:parse_args
if "%~1"=="" goto after_args
if /i "%~1"=="dev" set "MODE=dev"
if /i "%~1"=="--dev" set "MODE=dev"
if /i "%~1"=="--build" set "FORCE_BUILD=1"
if /i "%~1"=="--no-browser" set "OPEN_BROWSER=0"
shift
goto parse_args

:after_args
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
    if errorlevel 1 (
        echo [ERROR] npm install failed.
        pause
        exit /b 1
    )
)

if "%MODE%"=="dev" (
    echo Starting PokeQR Studio in development mode on http://localhost:%PORT% ...
    if "%OPEN_BROWSER%"=="1" (
        start "" /b cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:%PORT%"
    )
    call npm run dev
    goto end
)

if "%FORCE_BUILD%"=="1" goto do_build
if not exist "dist\server\index.js" goto do_build
if not exist "dist\client\index.html" goto do_build
goto start_prod

:do_build
echo Building PokeQR Studio...
call npm run build
if errorlevel 1 (
    echo [ERROR] Build failed.
    pause
    exit /b 1
)

:start_prod
echo Starting PokeQR Studio on http://localhost:%PORT% ...
if "%OPEN_BROWSER%"=="1" (
    start "" /b cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:%PORT%"
)
node dist\server\index.js --prod

:end
if errorlevel 1 (
    echo.
    echo Server exited with an error.
    pause
)
endlocal
