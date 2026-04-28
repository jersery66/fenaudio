@echo off
echo 停止 fenaudio 服务...
 powershell -Command "& { Get-NetTCPConnection -LocalPort 3200 -ErrorAction SilentlyContinue | ForEach-Object { try { Stop-Process $_.OwningProcess -Force } catch {} } }"
timeout /t 2 /nobreak >nul
echo 服务已停止
pause
