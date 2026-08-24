@echo off
title Industrial Monitor - Frontend (Painel)
cd /d "%~dp0frontend"

echo ============================================
echo   Iniciando FRONTEND (painel de monitoramento)
echo ============================================
echo.

python -m http.server 8080

pause