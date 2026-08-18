import snap7

PLC_IP = "192.168.0.121"
RACK = 0
SLOT = 1

plc = snap7.Client()

print("Conectando ao CLP...")

plc.connect(PLC_IP, RACK, SLOT)

if plc.get_connected():
    print("CLP conectado com sucesso!")
else:
    print("Não foi possível conectar ao CLP.")