@echo off
title Industrial Monitor - Backend (CLP + API)
cd /d "%~dp0"

echo ============================================
echo   Iniciando BACKEND (API + conexao com CLP)
echo ============================================
echo.

REM Ativa o ambiente virtual Python (.venv)
call .venv\Scripts\activate

REM Sobe a API a partir da RAIZ do projeto (necessario porque o
REM codigo usa imports do tipo "from backend.xxx import ...", que
REM so resolvem com backend/ visto como pacote a partir da raiz)
REM aceitando conexoes de qualquer dispositivo na rede
uvicorn backend.main:app --host 0.0.0.0 --port 8000

pause