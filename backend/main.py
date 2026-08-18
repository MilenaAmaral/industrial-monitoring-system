from plc_connection import conectar_plc


plc = conectar_plc()

if plc:
    print("Teste concluído.")
    plc.disconnect()
    print("CLP desconectado.")
else:
    print("Teste de conexão falhou.")