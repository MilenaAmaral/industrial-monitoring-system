from fastapi import FastAPI
from plc_connection import conectar_plc


app = FastAPI(
    title="Industrial Monitoring System",
    description="API para monitoramento de CLP Siemens",
    version="1.0.0"
)


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