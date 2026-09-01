from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime

from backend.plc_connection import conectar_plc
from backend.plc_reader import VARIAVEIS_PRODUCAO, VARIAVEIS_ALARMES, ler_variavel
from backend.mysql_connection import conectar_mysql
from backend.salvar_leitura_mysql import montar_valores, salvar_leitura_producao
from backend.automacao import iniciar_leitura_automatica
from backend.paradas import evento_em_andamento, listar_paradas, resumo_paradas
from backend.alarmes import eventos_em_andamento, listar_eventos_alarme, resumo_alarmes
from backend.historico import listar_leituras, resumo_periodo, producao_diaria


app = FastAPI(
    title="Industrial Monitoring System",
    description="API para monitoramento de CLP Siemens",
    version="1.0.0"
)

# CORS liberado para desenvolvimento local (o frontend roda em outra origem/porta).
# Em producao, troque allow_origins=["*"] pelo dominio real do frontend.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def iniciar_automacao():
    """Dispara a leitura automatica periodica (background) ao subir a API."""
    iniciar_leitura_automatica()


@app.get("/")
def home():
    return {
        "status": "online",
        "sistema": "Industrial Monitoring System"
    }


@app.get("/plc/status")
def plc_status():
    plc = conectar_plc()

    if plc:
        plc.disconnect()

        return {
            "conectado": True,
            "mensagem": "CLP conectado com sucesso."
        }

    return {
        "conectado": False,
        "mensagem": "Nao foi possivel conectar ao CLP."
    }


@app.get("/plc/producao")
def plc_producao():
    """Le em tempo real as variaveis de producao (DB5) do CLP."""
    plc = conectar_plc()

    if not plc:
        return {
            "conectado": False,
            "mensagem": "Nao foi possivel conectar ao CLP.",
            "dados": None
        }

    dados = {}
    erros = {}

    for var in VARIAVEIS_PRODUCAO:
        leitura = ler_variavel(plc, var)

        if leitura["sucesso"]:
            dados[var["nome"]] = leitura["valor_convertido"]
        else:
            erros[var["nome"]] = leitura["categoria_erro"]

    plc.disconnect()

    return {
        "conectado": True,
        "dados": dados,
        "erros": erros if erros else None
    }


@app.get("/plc/alarmes")
def plc_alarmes():
    """Le em tempo real os alarmes (DB8) do CLP."""
    plc = conectar_plc()

    if not plc:
        return {
            "conectado": False,
            "mensagem": "Nao foi possivel conectar ao CLP.",
            "algum_ativo": False,
            "alarmes": None
        }

    alarmes = {}
    erros = {}

    for var in VARIAVEIS_ALARMES:
        leitura = ler_variavel(plc, var)

        if leitura["sucesso"]:
            alarmes[var["nome"]] = leitura["valor_convertido"]
        else:
            erros[var["nome"]] = leitura["categoria_erro"]

    plc.disconnect()

    algum_ativo = any(alarmes.values()) if alarmes else False

    return {
        "conectado": True,
        "algum_ativo": algum_ativo,
        "alarmes": alarmes,
        "erros": erros if erros else None
    }


@app.post("/plc/salvar")
def plc_salvar():
    """Le as variaveis de producao do CLP e salva uma leitura no MySQL."""
    plc = conectar_plc()

    if not plc:
        return {
            "sucesso": False,
            "mensagem": "Nao foi possivel conectar ao CLP."
        }

    valores = montar_valores(plc, VARIAVEIS_PRODUCAO)
    plc.disconnect()

    if valores is None:
        return {
            "sucesso": False,
            "mensagem": "Falha ao ler uma ou mais variaveis do CLP. Nada foi salvo."
        }

    conexao = conectar_mysql()

    if not conexao:
        return {
            "sucesso": False,
            "mensagem": "Nao foi possivel conectar ao MySQL."
        }

    salvar_leitura_producao(conexao, valores)
    conexao.close()

    return {
        "sucesso": True,
        "mensagem": "Leitura salva com sucesso.",
        "dados": valores
    }


@app.get("/producao/status")
def producao_status():
    """
    Estado atual da maquina (rodando/parada/falha) e os cronometros
    atuais, lidos ao vivo do CLP. Os tempos de producao vem direto do
    acumulador do proprio CLP - nunca zeram sozinhos, mesmo que a API
    reinicie. Se algum alarme estiver ativo, o estado "falha" tem
    prioridade sobre rodando/parada.
    """
    plc = conectar_plc()

    if not plc:
        return {
            "conectado": False,
            "mensagem": "Nao foi possivel conectar ao CLP."
        }

    valores = montar_valores(plc, VARIAVEIS_PRODUCAO)
    plc.disconnect()

    if valores is None:
        return {
            "conectado": False,
            "mensagem": "Falha ao ler variaveis do CLP."
        }

    tempo_rodando = valores.get("TempoRodando", 0)
    tempo_parado = valores.get("TempoParado", 0)

    alarmes_ativos = eventos_em_andamento()

    if alarmes_ativos:
        estado = "falha"
        info_parada_atual = None
    else:
        parada_atual = evento_em_andamento()

        if parada_atual:
            estado = "parada"
            duracao_parada_atual = tempo_parado - parada_atual["tempo_parado_inicio"]
            info_parada_atual = {
                "inicio": parada_atual["inicio"],
                "duracao_segundos": duracao_parada_atual,
            }
        else:
            estado = "rodando"
            info_parada_atual = None

    resumo = resumo_paradas() or {}

    agora = datetime.now()
    info_alarmes_ativos = [
        {
            "nome": alarme["nome_alarme"],
            "inicio": alarme["inicio"],
            "duracao_segundos": int((agora - alarme["inicio"]).total_seconds()),
        }
        for alarme in alarmes_ativos
    ]

    return {
        "conectado": True,
        "estado": estado,
        "tempo_rodando_segundos": tempo_rodando,
        "tempo_parado_segundos": tempo_parado,
        "paletes_prontos": valores.get("ContagemPaletesProntos", 0),
        "caixas_por_palete": valores.get("ContagemCaixasPalete", 0),
        "parada_atual": info_parada_atual,
        "quantidade_paradas": resumo.get("quantidade", 0),
        "alarmes_ativos": info_alarmes_ativos,
    }


@app.get("/producao/alarmes")
def producao_alarmes(limite: int = 50):
    """Lista o historico de alarmes (mais novo primeiro)."""
    return {"alarmes": listar_eventos_alarme(limite)}


@app.get("/producao/alarmes/resumo")
def producao_alarmes_resumo():
    """Estatisticas por alarme: quantas vezes ativou e tempo total ativo."""
    return {"resumo": resumo_alarmes()}


@app.get("/producao/paradas")
def producao_paradas(limite: int = 50):
    """Lista as paradas mais recentes (mais nova primeiro)."""
    return {"paradas": listar_paradas(limite)}


@app.get("/producao/paradas/resumo")
def producao_paradas_resumo():
    """Estatisticas agregadas: quantidade, tempo total, maior parada e media."""
    resumo = resumo_paradas()

    return resumo or {
        "quantidade": 0,
        "tempo_total_segundos": 0,
        "maior_parada_segundos": 0,
        "media_segundos": 0,
    }



@app.get("/producao/historico")
def producao_historico(
    data_inicio: str = None,
    data_fim: str = None,
    pagina: int = 1,
    por_pagina: int = 50,
):
    """
    Lista o historico de leituras de producao (tabela leituras_producao),
    mais recente primeiro, com filtro opcional por data (AAAA-MM-DD) e
    paginacao.
    """
    resultado = listar_leituras(data_inicio, data_fim, pagina, por_pagina)

    if "erro" in resultado:
        return {"sucesso": False, "mensagem": resultado["erro"]}

    return {"sucesso": True, **resultado}


@app.get("/producao/historico/resumo")
def producao_historico_resumo(data_inicio: str = None, data_fim: str = None):
    """
    Totais do periodo filtrado (producao, tempo rodando e tempo parado),
    calculados pela diferenca entre a primeira e a ultima leitura do
    intervalo.
    """
    resultado = resumo_periodo(data_inicio, data_fim)

    if "erro" in resultado:
        return {"sucesso": False, "mensagem": resultado["erro"]}

    return {"sucesso": True, **resultado}



@app.get("/producao/historico/diario")
def producao_historico_diario(data_inicio: str = None, data_fim: str = None):
    """
    Producao, tempo rodando, tempo parado e eficiencia agregados por dia
    (usado pelos graficos de Producao por Dia, Tempo Parado e Eficiencia).
    """
    resultado = producao_diaria(data_inicio, data_fim)

    if "erro" in resultado:
        return {"sucesso": False, "mensagem": resultado["erro"]}

    return {"sucesso": True, **resultado}