@echo off
echo ========================================
echo   fenaudio 个性化AI电台 启动中...
echo ========================================
echo.

echo [1/2] 启动网易云音乐API (端口3000)...
start "NeteaseAPI" /min cmd /c "cd /d %~dp0NeteaseCloudMusicApiGitee && node app.js"
timeout /t 3 /nobreak >nul

echo [2/2] 启动fenaudio服务 (端口3200)...
echo.
echo   服务地址: http://localhost:3200
echo.
node server/index.js
pause
