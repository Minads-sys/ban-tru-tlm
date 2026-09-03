@echo off
chcp 65001 >nul
echo ========================================================
echo   TỰ ĐỘNG ĐẨY CODE LÊN GITHUB & CẬP NHẬT TRỰC TIẾP VPS
echo ========================================================
echo.

echo 1. Lưu thay đổi và đẩy lên GitHub...
git add .
for /f "delims=" %%a in ('powershell -Command "Get-Date -Format 'yyyy-MM-dd HH:mm:ss'"') do set datetime=%%a
git commit -m "Update: %datetime%"
git push origin main

echo.
echo 2. Kết nối đến VPS (14.225.224.121) để cập nhật website...
python sync_vps.py

echo.
echo ========================================================
echo   HOÀN TẤT! WEBSITE ĐÃ ĐƯỢC CẬP NHẬT TẠI: bantrutlm.com
echo ========================================================
pause
