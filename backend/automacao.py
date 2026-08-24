"""
Loop unico de monitoramento do CLP.

Faz duas coisas no mesmo ciclo (para nao abrir duas conexoes
concorrentes com o mesmo CLP):

1. A cada MONITORAMENTO_INTERVALO_SEGUNDOS: le as variaveis de producao
   e detecta se a maquina esta rodando ou parada, comparando com a
   leitura anterior. Ao detectar uma transicao, abre/fecha um evento
   em eventos_parada (via paradas.py).

2. A cada LEITURA_INTERVALO_SEGUNDOS: salva um snapshot completo na
   tabela leituras_producao (comportamento que ja existia).

Iniciado automaticamente quando a API sobe (ver main.py).
"""

import os
import threading
import time

from dotenv import load_dotenv

from plc_connection import conectar_plc
from mysql_connection import conectar_mysql
from plc_reader import VARIAVEIS_PRODUCAO
from salvar_leitura_mysql import montar_valores, salvar_leitura_producao
from paradas import abrir_evento_parada, fechar_evento_parada, retomar_evento_aberto

load_dotenv()

MONITORAMENTO_INTERVALO_SEGUNDOS = int(os.getenv("MONITORAMENTO_INTERVALO_SEGUNDOS", "2"))
LEITURA_INTERVALO_SEGUNDOS = int(os.getenv("LEITURA_INTERVALO_SEGUNDOS", "10"))
ATIVA = os.getenv("LEITURA_AUTOMATICA_ATIVA", "true").lower() == "true"


# Estado em memoria deste processo - necessario para saber se houve
# transicao entre um ciclo e o outro.
_estado_atual = None  # "rodando" | "parada" | None (ainda nao sabemos)
_ultimo_tempo_rodando = None


def _inicializar_estado():
    """
    Roda uma vez, ao iniciar o monitoramento. Verifica se ja existia uma
    parada em andamento no banco (de uma execucao anterior da API) e
    retoma o estado corretamente, em vez de assumir "rodando" as cegas.
    """
    global _estado_atual

    evento_pendente = retomar_evento_aberto()
    _estado_atual = "parada" if evento_pendente else None


def _detectar_e_tratar_estado(tempo_rodando, tempo_parado):
    """
    Compara o tempo rodando atual com o anterior: se nao avancou, a
    maquina esta parada; caso contrario, esta rodando. Abre/fecha
    eventos de parada quando ha transicao de estado.
    """
    global _estado_atual, _ultimo_tempo_rodando

    if _ultimo_tempo_rodando is None:
        _ultimo_tempo_rodando = tempo_rodando

        # Se nao ha estado definido ainda (nenhuma parada pendente foi
        # retomada), assume "rodando" como ponto de partida neutro.
        if _estado_atual is None:
            _estado_atual = "rodando"

        return

    novo_estado = "rodando" if tempo_rodando > _ultimo_tempo_rodando else "parada"
    _ultimo_tempo_rodando = tempo_rodando

    if novo_estado == _estado_atual:
        return  # nada mudou

    if novo_estado == "parada":
        abrir_evento_parada(tempo_parado)
        print("[monitoramento] Parada detectada - evento aberto.")

    elif novo_estado == "rodando" and _estado_atual == "parada":
        fechar_evento_parada(tempo_parado)
        print("[monitoramento] Máquina voltou a rodar - evento fechado.")

    _estado_atual = novo_estado


def loop_monitoramento():
    print(
        f"[monitoramento] Iniciado - checando estado a cada "
        f"{MONITORAMENTO_INTERVALO_SEGUNDOS}s, salvando snapshot a cada "
        f"{LEITURA_INTERVALO_SEGUNDOS}s."
    )

    _inicializar_estado()

    ultimo_snapshot = 0.0

    while True:
        try:
            plc = conectar_plc()

            if not plc:
                print("[monitoramento] Falha ao conectar no CLP. Pulando ciclo.")
            else:
                valores = montar_valores(plc, VARIAVEIS_PRODUCAO)
                plc.disconnect()

                if valores is None:
                    print("[monitoramento] Falha ao ler variaveis do CLP. Pulando ciclo.")
                else:
                    tempo_rodando = valores.get("TempoRodando", 0)
                    tempo_parado = valores.get("TempoParado", 0)

                    _detectar_e_tratar_estado(tempo_rodando, tempo_parado)

                    agora = time.time()
                    if agora - ultimo_snapshot >= LEITURA_INTERVALO_SEGUNDOS:
                        conexao = conectar_mysql()

                        if conexao:
                            try:
                                salvar_leitura_producao(conexao, valores)
                            finally:
                                conexao.close()
                        else:
                            print("[monitoramento] Falha ao conectar no MySQL. Snapshot não salvo.")

                        ultimo_snapshot = agora

        except Exception as erro:
            # Protecao extra: qualquer erro inesperado nao pode derrubar a thread.
            print(f"[monitoramento] Erro inesperado no ciclo: {erro}")

        time.sleep(MONITORAMENTO_INTERVALO_SEGUNDOS)


def iniciar_leitura_automatica():
    """
    Inicia o monitoramento em uma thread separada (background), se
    estiver habilitado no .env (LEITURA_AUTOMATICA_ATIVA=true).
    A thread e "daemon" para nao impedir o encerramento do programa.
    """
    if not ATIVA:
        print("[monitoramento] Desabilitado (LEITURA_AUTOMATICA_ATIVA=false).")
        return

    thread = threading.Thread(target=loop_monitoramento, daemon=True)
    thread.start()