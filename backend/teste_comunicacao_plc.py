"""
TESTE DE COMUNICACAO - SIEMENS S7-1500
========================================
"""

from backend.plc_connection import conectar_plc
from backend.plc_reader import VARIAVEIS, VARIAVEIS_PRODUCAO, ler_variavel, formatar_endereco


def executar_leituras(plc, variaveis):
    """Le uma lista de variaveis e imprime o resultado de cada uma no terminal."""
    resultados = []

    for i, var in enumerate(variaveis, start=1):
        endereco = formatar_endereco(var)
        leitura = ler_variavel(plc, var)

        print(f"[{i}] {var['nome']}")
        print(f"Endereço: {endereco}")
        print(f"Tipo: {var['tipo']}")

        if leitura["sucesso"]:
            if var["tipo"] == "STRING":
                print(f"Valor: {leitura['valor_convertido']}")
            elif var["tipo"] == "REAL":
                print(f"Valor bruto: {leitura['valor_bruto']}")
                print(f"Valor: {int(round(leitura['valor_convertido']))}")
            else:
                print(f"Valor bruto: {leitura['valor_bruto']}")
                print(f"Valor: {leitura['valor_convertido']}")
        else:
            print(f"✗ FALHA NA LEITURA ({leitura['categoria_erro']})")
            print(f"Detalhe: {leitura['erro']}")

        print()
        resultados.append((var["nome"], leitura["sucesso"], leitura.get("categoria_erro")))

    return resultados


def executar_teste():
    print("=" * 40)
    print(" TESTE DE COMUNICAÇÃO - SIEMENS S7-1500")
    print("=" * 40)

    todas_variaveis = VARIAVEIS + VARIAVEIS_PRODUCAO

    if not todas_variaveis:
        print("\nNenhuma variavel configurada em plc_reader.py.\n")
        return

    print("Conectando ao CLP...")
    plc = conectar_plc()

    if not plc:
        print("✗ Falha de conexão com o CLP.")
        print("\n" + "=" * 40)
        print("RESULTADO DO TESTE")
        print("=" * 40)
        print("✗ Conexão: FALHOU")
        return

    print("✓ Conexão estabelecida\n")

    resultados = executar_leituras(plc, todas_variaveis)

    plc.disconnect()

    print("=" * 40)
    print("RESULTADO DO TESTE")
    print("=" * 40)
    print("✓ Conexão: OK")

    for nome, sucesso, categoria in resultados:
        if sucesso:
            print(f"✓ {nome}: OK")
        else:
            print(f"✗ {nome}: FALHOU ({categoria})")

    print("\nConexão encerrada.")


if __name__ == "__main__":
    executar_teste()