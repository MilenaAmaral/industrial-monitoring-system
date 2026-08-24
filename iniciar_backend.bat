@echo off
title Industrial Monitor - Backend (CLP + API)
cd /d "%~dp0backend"

echo ============================================
echo   Iniciando BACKEND (API + conexao com CLP)
echo ============================================
echo.

REM Ativa o ambiente virtual Python (.venv)
call ..\.venv\Scripts\activate

REM Sobe a API aceitando conexoes de qualquer dispositivo na rede
uvicorn main:app --host 0.0.0.0 --port 8000

pause