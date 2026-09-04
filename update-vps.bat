@echo off
setlocal
cd /d "%~dp0"
chcp 65001 >nul

echo ========================================================
echo   DONG BO CODE LEN GITHUB VA CAP NHAT TRUC TIEP VPS
echo ========================================================
echo.

echo 1. Dang luu thay doi va day len GitHub...
git add .
for /f "tokens=*" %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd_HH:mm:ss"') do set DT=%%i
git commit -m "Update: %DT%"
git push origin main

echo.
echo 2. Dang ket noi den VPS (14.225.224.121) de cap nhat website...
python sync_vps.py

echo.
echo ========================================================
echo   HOAN TAT! WEBSITE DA DUOC CAP NHAT TAI: bantrutlm.com
echo ========================================================
pause
