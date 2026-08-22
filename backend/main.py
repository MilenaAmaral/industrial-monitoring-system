from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from backend.plc_connection import conectar_plc
from backend.plc_reader import VARIAVEIS_PRODUCAO, ler_variavel
from backend.mysql_connection import conectar_mysql
from backend.salvar_leitura_mysql import montar_valores, salvar_leitura_producao
from backend.automacao import iniciar_leitura_automatica

BASE_DIR = Path(__file__).resolve().parent.parent

app = FastAPI(
    title="Industrial Monitoring System",
    description="API para monitoramento de CLP Siemens",
    version="1.0.0"
)

app.mount(
    "/img",
    StaticFiles(directory=BASE_DIR / "img"),
    name="img"
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