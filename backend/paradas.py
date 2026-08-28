"""
Gestao de eventos de parada da maquina, persistidos na tabela
eventos_parada do MySQL.

Cada parada e uma linha propria: criada quando a maquina para,
atualizada (nunca sobrescrita/substituida) quando volta a rodar.

A duracao e calculada a partir dos acumuladores do proprio CLP
(tempo_parado_inicio / tempo_parado_fim), nao do relogio do servidor -
assim o valor fica correto mesmo se o processo Python demorar um
pouco para reagir a transicao.
"""

from datetime import datetime

from mysql_connection import conectar_mysql


# Id do evento de parada em andamento, em memoria neste processo.
# Se a API reiniciar no meio de uma parada, retomar_evento_aberto()
# recupera esse id consultando o banco (ver automacao.py).
_evento_aberto_id = None


def abrir_evento_parada(tempo_parado_inicio):
    """
    Cria uma nova linha em eventos_parada com inicio = agora.
    fim/duracao ficam nulos ate a parada terminar.
    """
    global _evento_aberto_id

    conexao = conectar_mysql()
    if not conexao:
        print("[paradas] Falha ao conectar no MySQL. Evento de parada nao registrado.")
        return None

    try:
        cursor = conexao.cursor()
        cursor.execute(
            """
            INSERT INTO eventos_parada (inicio, tempo_parado_inicio)
            VALUES (%s, %s)
            """,
            (datetime.now(), tempo_parado_inicio),
        )
        conexao.commit()
        _evento_aberto_id = cursor.lastrowid
        cursor.close()
        return _evento_aberto_id
    finally:
        conexao.close()


def fechar_evento_parada(tempo_parado_fim):
    """
    Atualiza a linha de parada em andamento com fim = agora e a
    duracao (calculada a partir do acumulador do CLP).
    """
    global _evento_aberto_id

    if _evento_aberto_id is None:
        print(
            "[paradas] Aviso: maquina voltou a rodar mas nao havia "
            "evento de parada aberto neste processo."
        )
        return

    conexao = conectar_mysql()
    if not conexao:
        print("[paradas] Falha ao conectar no MySQL. Evento de parada nao foi fechado.")
        return

    try:
        cursor = conexao.cursor()
        cursor.execute(
            "SELECT tempo_parado_inicio FROM eventos_parada WHERE id = %s",
            (_evento_aberto_id,),
        )
        linha = cursor.fetchone()

        if linha is None:
            print(f"[paradas] Evento {_evento_aberto_id} nao encontrado no banco.")
            return

        tempo_parado_inicio = linha[0]
        duracao = max(0, tempo_parado_fim - tempo_parado_inicio)

        cursor.execute(
            """
            UPDATE eventos_parada
            SET fim = %s, tempo_parado_fim = %s, duracao_segundos = %s
            WHERE id = %s
            """,
            (datetime.now(), tempo_parado_fim, duracao, _evento_aberto_id),
        )
        conexao.commit()
        cursor.close()

    finally:
        conexao.close()
        _evento_aberto_id = None


def retomar_evento_aberto():
    """
    Verifica se ja existe um evento de parada aberto no banco (fim IS NULL),
    de uma execucao anterior do servidor (ex: a API reiniciou no meio de
    uma parada), e retoma o controle dele em memoria.
    Retorna o registro encontrado, ou None se nao havia nenhum.
    """
    global _evento_aberto_id

    registro = evento_em_andamento()

    if registro:
        _evento_aberto_id = registro["id"]
        print(f"[paradas] Retomando evento de parada em andamento (id {_evento_aberto_id}).")

    return registro


def evento_em_andamento():
    """Retorna a parada em andamento (fim IS NULL), se houver."""
    conexao = conectar_mysql()
    if not conexao:
        return None

    try:
        cursor = conexao.cursor(dictionary=True)
        cursor.execute(
            """
            SELECT id, inicio, tempo_parado_inicio
            FROM eventos_parada
            WHERE fim IS NULL
            ORDER BY inicio DESC
            LIMIT 1
            """
        )
        return cursor.fetchone()
    finally:
        conexao.close()


def listar_paradas(limite=50):
    """
    Retorna as paradas mais recentes (mais nova primeiro), com o
    'motivo' de cada uma: os nomes tecnicos dos alarmes (tabela
    eventos_alarme) que estavam ativos durante aquela parada, unidos
    por virgula. E None quando nenhum alarme se sobrepoe ao periodo
    da parada (ex: parada manual sem alarme).
    """
    conexao = conectar_mysql()
    if not conexao:
        return []

    try:
        cursor = conexao.cursor(dictionary=True)
        cursor.execute(
            """
            SELECT
                p.id, p.inicio, p.fim, p.duracao_segundos,
                GROUP_CONCAT(DISTINCT a.nome_alarme ORDER BY a.inicio SEPARATOR ',') AS motivo
            FROM eventos_parada p
            LEFT JOIN eventos_alarme a
                ON a.inicio <= COALESCE(p.fim, NOW())
                AND p.inicio <= COALESCE(a.fim, NOW())
            GROUP BY p.id, p.inicio, p.fim, p.duracao_segundos
            ORDER BY p.inicio DESC
            LIMIT %s
            """,
            (limite,),
        )
        return cursor.fetchall()
    finally:
        conexao.close()


def resumo_paradas():
    """
    Estatisticas agregadas das paradas ja concluidas: quantidade,
    tempo total parado, maior parada e media de duracao.
    """
    conexao = conectar_mysql()
    if not conexao:
        return None

    try:
        cursor = conexao.cursor(dictionary=True)
        cursor.execute(
            """
            SELECT
                COUNT(*) AS quantidade,
                COALESCE(SUM(duracao_segundos), 0) AS tempo_total_segundos,
                COALESCE(MAX(duracao_segundos), 0) AS maior_parada_segundos,
                COALESCE(AVG(duracao_segundos), 0) AS media_segundos
            FROM eventos_parada
            WHERE duracao_segundos IS NOT NULL
            """
        )
        return cursor.fetchone()
    finally:
        conexao.close()