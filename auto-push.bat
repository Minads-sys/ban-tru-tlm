@echo off
echo ==============================================
echo   TU DONG DAY CODE LEN GITHUB
echo ==============================================

:: Kiem tra neu chua lien ket voi Github
git remote -v | findstr "origin" >nul
if %errorlevel% neq 0 (
    echo.
    echo [LOI]: Du an chua duoc lien ket voi GitHub!
    echo.
    echo Huong dan lien ket:
    echo 1. Len github.com tao 1 repository moi ^(khong tao file README^)
    echo 2. Copy duong link cua repository ^(vi du: https://github.com/ten/repo.git^)
    echo 3. Mo Terminal trong VS Code va chay lenh sau:
    echo    git remote add origin LINK_CUA_BAN
    echo    git branch -M main
    echo    git push -u origin main
    echo.
    pause
    exit /b
)

echo.
echo 1. Dang kiem tra thay doi...
git add .

echo 2. Dang luu lich su...
for /f "delims=" %%a in ('powershell -Command "Get-Date -Format 'yyyy-MM-dd HH:mm:ss'"') do set datetime=%%a
git commit -m "Auto sync: %datetime%"

echo 3. Dang day len GitHub...
git push origin main

echo.
echo ==============================================
echo   HOAN THANH! CODE DA DUOC LUU LEN GITHUB
echo ==============================================
pause
