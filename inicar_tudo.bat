@echo off
title Industrial Monitor - Iniciando Sistema Completo
cd /d "%~dp0"

echo ============================================
echo   INDUSTRIAL MONITOR - Iniciando sistema
echo ============================================
echo.
echo Abrindo backend e frontend em janelas separadas...
echo Nao feche essas janelas enquanto estiver usando o painel.
echo.

start "Backend" cmd /k "%~dp0iniciar_backend.bat"
timeout /t 3 /nobreak >nul
start "Frontend" cmd /k "%~dp0iniciar_frontend.bat"

echo.
echo Tudo pronto! Acesse o painel em outro dispositivo pela rede:
echo    http://192.168.0.121:8080
echo.
pause