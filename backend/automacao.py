"""
Leitura automatica periodica das variaveis de producao.

Iniciado automaticamente quando a API sobe (ver main.py).
"""

import os
import threading
import time

from dotenv import load_dotenv

from backend.plc_connection import conectar_plc
from backend.mysql_connection import conectar_mysql
from backend.plc_reader import VARIAVEIS_PRODUCAO
from backend.salvar_leitura_mysql import montar_valores, salvar_leitura_producao

load_dotenv()

INTERVALO_SEGUNDOS = int(os.getenv("LEITURA_INTERVALO_SEGUNDOS", "10"))
ATIVA = os.getenv("LEITURA_AUTOMATICA_ATIVA", "true").lower() == "true"


def executar_ciclo_leitura():
    """
    Executa um unico ciclo: conecta no CLP, le as variaveis de producao,
    conecta no MySQL e salva. Cada etapa e protegida - falha em uma nao
    derruba o programa, so pula esse ciclo e tenta de novo no proximo.
    """
    plc = conectar_plc()
    if not plc:
        print("[leitura automatica] Falha ao conectar no CLP. Pulando ciclo.")
        return

    valores = montar_valores(plc, VARIAVEIS_PRODUCAO)
    plc.disconnect()

    if valores is None:
        print("[leitura automatica] Falha ao ler variaveis do CLP. Pulando ciclo.")
        return

    conexao = conectar_mysql()
    if not conexao:
        print("[leitura automatica] Falha ao conectar no MySQL. Pulando ciclo.")
        return

    try:
        salvar_leitura_producao(conexao, valores)
    finally:
        conexao.close()


def loop_leitura_automatica():
    print(f"[leitura automatica] Iniciada - lendo a cada {INTERVALO_SEGUNDOS}s.")

    while True:
        try:
            executar_ciclo_leitura()
        except Exception as erro:
            # Protecao extra: qualquer erro inesperado nao pode derrubar a thread.
            print(f"[leitura automatica] Erro inesperado no ciclo: {erro}")

        time.sleep(INTERVALO_SEGUNDOS)


def iniciar_leitura_automatica():
    """
    Inicia a leitura automatica em uma thread separada (background),
    se estiver habilitada no .env (LEITURA_AUTOMATICA_ATIVA=true).
    A thread e "daemon" para nao impedir o encerramento do programa.
    """
    if not ATIVA:
        print("[leitura automatica] Desabilitada (LEITURA_AUTOMATICA_ATIVA=false).")
        return

    thread = threading.Thread(target=loop_leitura_automatica, daemon=True)
    thread.start()