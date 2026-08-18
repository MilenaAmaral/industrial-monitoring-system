import snap7


PLC_IP = "192.168.0.121"
RACK = 0
SLOT = 1


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