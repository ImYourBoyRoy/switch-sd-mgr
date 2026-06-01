@echo off
title Switch SD Manager - Premium Portable Builder
color 0b
echo ===================================================================
echo   Switch SD Manager - Standalone Portable Builder (Smoke Test Mode)
echo ===================================================================
echo.
echo  Prerequisites: Rust (rustup), Node.js (npm), and standard developer tools.
echo.
echo  [SYSTEM] Initializing build environment...
echo.

:: Run the premium PowerShell builder in Smoke mode (which compiles and validates structure)
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build.ps1 -Mode Smoke

echo.
echo ===================================================================
echo   Build process completed. Press any key to exit.
echo ===================================================================
pause > nul
