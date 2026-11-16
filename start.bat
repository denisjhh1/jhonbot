@echo off
title Jhon DISCORD BOT
color 0C

echo ========================================
echo         Jhon DISCORD BOT
echo ========================================
echo.

if not exist node_modules (
    echo [SYSTEM] node_modules not found...
    echo [SYSTEM] Installing dependencies...
    echo.

    npm install

    if %errorlevel% neq 0 (
        echo.
        echo [ERROR] Failed to install dependencies.
        pause
        exit
    )

    echo.
    echo [SUCCESS] Dependencies installed.
    node JhonBot.js
)

:restart
cls
echo ========================================
echo          Jhon BOT ONLINE
echo ========================================
echo.
echo [INFO] Starting JhonBot.js...
echo.

node JhonBot.js

echo.
echo [WARNING] Bot stopped or crashed...
echo [SYSTEM] Restarting in 5 seconds...
timeout /t 5 /nobreak >nul
goto restart