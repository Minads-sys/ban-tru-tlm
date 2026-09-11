@echo off
setlocal
cd /d "%~dp0"
chcp 65001 >nul

echo ========================================================
echo   SAO LƯU DỮ LIỆU CƠ SỞ DỮ LIỆU BÁN TRÚ TLM (SUPABASE)
echo ========================================================
echo.

node backup_data.js

echo.
echo Cac ban sao luu duoc luu trong thu muc: backups\
echo ========================================================
pause
