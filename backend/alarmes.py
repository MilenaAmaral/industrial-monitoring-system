"""
Gestao de eventos de alarme, persistidos na tabela eventos_alarme
do MySQL.

Diferente das paradas (onde so existe UM evento por vez), varios
alarmes podem estar ativos ao mesmo tempo (ex: "EmergenciaAcionada"
e "SistemaEmManual" simultaneamente). Por isso o controle em memoria
e um dicionario: nome_do_alarme -> id do evento aberto.

A duracao aqui e calculada pelo relogio do servidor (datetime.now()),
diferente das paradas, porque os alarmes nao tem um acumulador de
tempo dentro do proprio CLP (sao so bits ligado/desligado).
"""

from datetime import datetime

from backend.mysql_connection import conectar_mysql


# nome_do_alarme -> id do evento aberto neste processo
_eventos_abertos = {}


def abrir_evento_alarme(nome_alarme):
    """Cria uma nova linha em eventos_alarme com inicio = agora."""
    global _eventos_abertos

    conexao = conectar_mysql()
    if not conexao:
        print(f"[alarmes] Falha ao conectar no MySQL. Evento de '{nome_alarme}' nao registrado.")
        return None

    try:
        cursor = conexao.cursor()
        cursor.execute(
            """
            INSERT INTO eventos_alarme (nome_alarme, inicio)
            VALUES (%s, %s)
            """,
            (nome_alarme, datetime.now()),
        )
        conexao.commit()
        evento_id = cursor.lastrowid
        cursor.close()
        _eventos_abertos[nome_alarme] = evento_id
        return evento_id
    finally:
        conexao.close()


def fechar_evento_alarme(nome_alarme):
    """Atualiza a linha do alarme com fim = agora e a duracao total."""
    global _eventos_abertos

    evento_id = _eventos_abertos.get(nome_alarme)

    if evento_id is None:
        print(
            f"[alarmes] Aviso: alarme '{nome_alarme}' desligou mas nao "
            "havia evento aberto neste processo."
        )
        return

    conexao = conectar_mysql()
    if not conexao:
        print(f"[alarmes] Falha ao conectar no MySQL. Evento de '{nome_alarme}' nao foi fechado.")
        return

    try:
        cursor = conexao.cursor()
        cursor.execute(
            "SELECT inicio FROM eventos_alarme WHERE id = %s",
            (evento_id,),
        )
        linha = cursor.fetchone()

        if linha is None:
            print(f"[alarmes] Evento {evento_id} nao encontrado no banco.")
            return

        inicio = linha[0]
        fim = datetime.now()
        duracao = max(0, int((fim - inicio).total_seconds()))

        cursor.execute(
            """
            UPDATE eventos_alarme
            SET fim = %s, duracao_segundos = %s
            WHERE id = %s
            """,
            (fim, duracao, evento_id),
        )
        conexao.commit()
        cursor.close()

    finally:
        conexao.close()
        _eventos_abertos.pop(nome_alarme, None)


def retomar_eventos_abertos():
    """
    Verifica se ja existiam alarmes abertos no banco (fim IS NULL), de
    uma execucao anterior da API (ex: reiniciou com um alarme ativo),
    e retoma o controle deles em memoria.

    Retorna um dicionario {nome_alarme: True} para o automacao.py
    inicializar o estado corretamente, sem recriar eventos duplicados.
    """
    global _eventos_abertos

    conexao = conectar_mysql()
    if not conexao:
        return {}

    try:
        cursor = conexao.cursor(dictionary=True)
        cursor.execute(
            """
            SELECT id, nome_alarme
            FROM eventos_alarme
            WHERE fim IS NULL
            """
        )
        linhas = cursor.fetchall()
    finally:
        conexao.close()

    estados = {}
    for linha in linhas:
        _eventos_abertos[linha["nome_alarme"]] = linha["id"]
        estados[linha["nome_alarme"]] = True
        print(f"[alarmes] Retomando alarme em andamento: {linha['nome_alarme']} (id {linha['id']}).")

    return estados


def eventos_em_andamento():
    """Retorna os alarmes ativos agora (fim IS NULL), mais novo primeiro."""
    conexao = conectar_mysql()
    if not conexao:
        return []

    try:
        cursor = conexao.cursor(dictionary=True)
        cursor.execute(
            """
            SELECT id, nome_alarme, inicio
            FROM eventos_alarme
            WHERE fim IS NULL
            ORDER BY inicio DESC
            """
        )
        return cursor.fetchall()
    finally:
        conexao.close()


def listar_eventos_alarme(limite=50):
    """Retorna os eventos de alarme mais recentes (mais novo primeiro)."""
    conexao = conectar_mysql()
    if not conexao:
        return []

    try:
        cursor = conexao.cursor(dictionary=True)
        cursor.execute(
            """
            SELECT id, nome_alarme, inicio, fim, duracao_segundos
            FROM eventos_alarme
            ORDER BY inicio DESC
            LIMIT %s
            """,
            (limite,),
        )
        return cursor.fetchall()
    finally:
        conexao.close()


def resumo_alarmes():
    """Estatisticas agregadas por alarme: quantas vezes e tempo total ativo."""
    conexao = conectar_mysql()
    if not conexao:
        return []

    try:
        cursor = conexao.cursor(dictionary=True)
        cursor.execute(
            """
            SELECT
                nome_alarme,
                COUNT(*) AS quantidade,
                COALESCE(SUM(duracao_segundos), 0) AS tempo_total_segundos
            FROM eventos_alarme
            WHERE duracao_segundos IS NOT NULL
            GROUP BY nome_alarme
            """
        )
        return cursor.fetchall()
    finally:
        conexao.close()