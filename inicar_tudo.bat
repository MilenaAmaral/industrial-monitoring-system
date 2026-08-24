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
echo Tudo pronto! Descobrindo o IP deste computador...
echo.

for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /R /C:"IPv4"') do (
    set IP=%%a
    goto :achou
)
:achou
set IP=%IP: =%

echo ============================================
echo Acesse o painel em outro dispositivo pela rede:
echo    http://%IP%:8080
echo ============================================
echo.
echo (Se esse IP nao funcionar, rode "ipconfig" manualmente
echo  e procure o "Endereco IPv4" da rede Wi-Fi/Ethernet certa)
echo.
pause