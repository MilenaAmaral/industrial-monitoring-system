import os

import snap7
from dotenv import load_dotenv

load_dotenv()


def _variavel_obrigatoria(nome):
    """
    Le uma variavel de ambiente obrigatoria. Levanta um erro claro na
    inicializacao se ela nao estiver definida, em vez de usar um valor
    padrao (o IP do CLP e um dado especifico da rede local, nao deve
    ter um valor de exemplo "real" hardcoded no codigo-fonte).
    """
    valor = os.getenv(nome)

    if not valor:
        raise RuntimeError(
            f"Variavel de ambiente '{nome}' nao definida. "
            f"Configure-a no arquivo .env (veja backend/.env.example)."
        )

    return valor


PLC_IP = _variavel_obrigatoria("PLC_IP")
RACK = int(os.getenv("PLC_RACK", "0"))
SLOT = int(os.getenv("PLC_SLOT", "1"))

def conectar_plc():
    plc = snap7.Client()

    print("Conectando ao CLP...")

    try:
        plc.connect(PLC_IP, RACK, SLOT)

        if plc.get_connected():
            print("CLP conectado com sucesso!")
            return plc

        print("Não foi possível conectar ao CLP.")
        return None

    except Exception as erro:
        print(f"Erro ao conectar ao CLP: {erro}")
        return None