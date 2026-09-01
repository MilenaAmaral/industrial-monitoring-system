"""
Consulta o historico de leituras de producao (snapshots periodicos),
persistidos na tabela leituras_producao pelo automacao.py.

"""

from datetime import datetime, timedelta

from backend.mysql_connection import conectar_mysql


def _parse_intervalo(data_inicio, data_fim):
    """
    Converte 'YYYY-MM-DD' em datetimes de inicio/fim do intervalo.
    data_fim e tratado como o dia inteiro (ate 23:59:59.999999).

    Retorna (inicio, fim, erro). 'erro' e uma mensagem (str) se algum
    parametro for invalido, ou None se estiver tudo certo. inicio/fim
    ficam None quando o respectivo filtro nao foi informado.
    """
    inicio = None
    fim = None

    try:
        if data_inicio:
            inicio = datetime.strptime(data_inicio, "%Y-%m-%d")
        if data_fim:
            fim = datetime.strptime(data_fim, "%Y-%m-%d") + timedelta(days=1)
    except ValueError:
        return None, None, "Datas devem estar no formato AAAA-MM-DD."

    if inicio and fim and inicio >= fim:
        return None, None, "data_inicio deve ser anterior a data_fim."

    return inicio, fim, None


def _montar_where(inicio, fim):
    """Monta a clausula WHERE e a lista de parametros para o filtro de data."""
    condicoes = []
    parametros = []

    if inicio:
        condicoes.append("data_hora >= %s")
        parametros.append(inicio)

    if fim:
        condicoes.append("data_hora < %s")
        parametros.append(fim)

    where = f"WHERE {' AND '.join(condicoes)}" if condicoes else ""

    return where, parametros


def listar_leituras(data_inicio=None, data_fim=None, pagina=1, por_pagina=50):
    """
    Lista leituras de producao paginadas, mais recente primeiro, com
    filtro opcional por intervalo de datas (data_inicio/data_fim).

    Retorna um dict com 'erro' se algo falhar, ou os dados + metadados
    de paginacao em caso de sucesso.
    """
    inicio, fim, erro = _parse_intervalo(data_inicio, data_fim)
    if erro:
        return {"erro": erro}

    try:
        pagina = int(pagina)
        por_pagina = int(por_pagina)
    except (TypeError, ValueError):
        return {"erro": "pagina e por_pagina devem ser numeros inteiros."}

    pagina = max(1, pagina)
    por_pagina = min(max(1, por_pagina), 200)
    offset = (pagina - 1) * por_pagina

    conexao = conectar_mysql()
    if not conexao:
        return {"erro": "Nao foi possivel conectar ao MySQL."}

    try:
        where, parametros = _montar_where(inicio, fim)

        cursor = conexao.cursor(dictionary=True)

        cursor.execute(
            f"SELECT COUNT(*) AS total FROM leituras_producao {where}",
            parametros,
        )
        total = cursor.fetchone()["total"]

        cursor.execute(
            f"""
            SELECT id, data_hora, contagem_paletes_prontos, contagem_caixas_palete,
                   tempo_parado, tempo_rodando
            FROM leituras_producao
            {where}
            ORDER BY data_hora DESC
            LIMIT %s OFFSET %s
            """,
            parametros + [por_pagina, offset],
        )
        leituras = cursor.fetchall()
        cursor.close()

        total_paginas = max(1, -(-total // por_pagina)) if total else 1

        return {
            "leituras": leituras,
            "pagina": pagina,
            "por_pagina": por_pagina,
            "total": total,
            "total_paginas": total_paginas,
        }
    except Exception as erro_consulta:
        print(f"[historico] Erro ao listar leituras: {erro_consulta}")
        return {"erro": "Erro ao consultar o historico de leituras no banco."}
    finally:
        conexao.close()


def resumo_periodo(data_inicio=None, data_fim=None):
    """
    Totais do periodo filtrado: producao (paletes prontos), tempo
    rodando e tempo parado, calculados pela diferenca entre a primeira
    e a ultima leitura do intervalo (os campos sao acumuladores do
    CLP, nao valores independentes por leitura).
    """
    inicio, fim, erro = _parse_intervalo(data_inicio, data_fim)
    if erro:
        return {"erro": erro}

    conexao = conectar_mysql()
    if not conexao:
        return {"erro": "Nao foi possivel conectar ao MySQL."}

    try:
        where, parametros = _montar_where(inicio, fim)

        cursor = conexao.cursor(dictionary=True)

        cursor.execute(
            f"""
            SELECT contagem_paletes_prontos, tempo_rodando, tempo_parado, data_hora
            FROM leituras_producao
            {where}
            ORDER BY data_hora ASC
            LIMIT 1
            """,
            parametros,
        )
        primeira = cursor.fetchone()

        cursor.execute(
            f"""
            SELECT contagem_paletes_prontos, tempo_rodando, tempo_parado, data_hora
            FROM leituras_producao
            {where}
            ORDER BY data_hora DESC
            LIMIT 1
            """,
            parametros,
        )
        ultima = cursor.fetchone()

        cursor.execute(
            f"SELECT COUNT(*) AS total FROM leituras_producao {where}",
            parametros,
        )
        quantidade = cursor.fetchone()["total"]

        cursor.close()

        if not primeira or not ultima:
            return {
                "producao_periodo": 0,
                "tempo_rodando_periodo": 0,
                "tempo_parado_periodo": 0,
                "primeira_leitura": None,
                "ultima_leitura": None,
                "quantidade_leituras": 0,
            }

        return {
            "producao_periodo": max(
                0, ultima["contagem_paletes_prontos"] - primeira["contagem_paletes_prontos"]
            ),
            "tempo_rodando_periodo": max(0, ultima["tempo_rodando"] - primeira["tempo_rodando"]),
            "tempo_parado_periodo": max(0, ultima["tempo_parado"] - primeira["tempo_parado"]),
            "primeira_leitura": primeira["data_hora"],
            "ultima_leitura": ultima["data_hora"],
            "quantidade_leituras": quantidade,
        }
    except Exception as erro_consulta:
        print(f"[historico] Erro ao calcular resumo do periodo: {erro_consulta}")
        return {"erro": "Erro ao consultar o resumo do periodo no banco."}
    finally:
        conexao.close()



def producao_diaria(data_inicio=None, data_fim=None):
    """
    Producao, tempo rodando e tempo parado agregados POR DIA, calculados
    como MAX(acumulador) - MIN(acumulador) dentro de cada dia.

    Retorna tambem a eficiencia do dia (tempo_rodando / (tempo_rodando +
    tempo_parado)), calculada a partir dos mesmos acumuladores.
    """
    inicio, fim, erro = _parse_intervalo(data_inicio, data_fim)
    if erro:
        return {"erro": erro}

    conexao = conectar_mysql()
    if not conexao:
        return {"erro": "Nao foi possivel conectar ao MySQL."}

    try:
        where, parametros = _montar_where(inicio, fim)

        cursor = conexao.cursor(dictionary=True)
        cursor.execute(
            f"""
            SELECT
                DATE(data_hora) AS dia,
                MIN(contagem_paletes_prontos) AS contagem_min,
                MAX(contagem_paletes_prontos) AS contagem_max,
                MIN(tempo_rodando) AS tempo_rodando_min,
                MAX(tempo_rodando) AS tempo_rodando_max,
                MIN(tempo_parado) AS tempo_parado_min,
                MAX(tempo_parado) AS tempo_parado_max,
                COUNT(*) AS quantidade_leituras
            FROM leituras_producao
            {where}
            GROUP BY DATE(data_hora)
            ORDER BY dia ASC
            """,
            parametros,
        )
        linhas = cursor.fetchall()
        cursor.close()

        dias = []

        for linha in linhas:
            producao_dia = max(0, linha["contagem_max"] - linha["contagem_min"])
            tempo_rodando_dia = max(0, linha["tempo_rodando_max"] - linha["tempo_rodando_min"])
            tempo_parado_dia = max(0, linha["tempo_parado_max"] - linha["tempo_parado_min"])
            tempo_total_dia = tempo_rodando_dia + tempo_parado_dia

            eficiencia_dia = (
                round((tempo_rodando_dia / tempo_total_dia) * 100, 1)
                if tempo_total_dia > 0
                else 0
            )

            dia = linha["dia"]

            dias.append(
                {
                    "dia": dia.isoformat() if hasattr(dia, "isoformat") else str(dia),
                    "producao_dia": producao_dia,
                    "tempo_rodando_dia": tempo_rodando_dia,
                    "tempo_parado_dia": tempo_parado_dia,
                    "eficiencia_dia": eficiencia_dia,
                    "quantidade_leituras": linha["quantidade_leituras"],
                }
            )

        return {"dias": dias}
    except Exception as erro_consulta:
        print(f"[historico] Erro ao calcular producao diaria: {erro_consulta}")
        return {"erro": "Erro ao consultar a producao diaria no banco."}
    finally:
        conexao.close()