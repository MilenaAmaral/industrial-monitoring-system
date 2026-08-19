from plc_connection import conectar_plc
from mysql_connection import conectar_mysql
from teste_comunicacao_plc import VARIAVEIS, ler_variavel


def montar_valores(plc):
    """
    Le cada variavel definida em VARIAVEIS (teste_comunicacao_plc.py) e
    organiza os valores convertidos num dicionario simples, por nome.
    Retorna None se alguma leitura falhar.
    """
    valores = {}

    for var in VARIAVEIS:
        leitura = ler_variavel(plc, var)

        if not leitura["sucesso"]:
            print(f"✗ Falha ao ler '{var['nome']}': {leitura['erro']}")
            return None

        valores[var["nome"]] = leitura["valor_convertido"]

    return valores


def salvar_leitura(conexao, valores):
    """
    Insere uma linha na tabela leituras_plc com os valores lidos.
    Espera as chaves: MEMORIA BOOL, MEMORIA INT, MEMORIA FLOAT, MEMORIA STRING
    (nomes definidos em VARIAVEIS, em teste_comunicacao_plc.py).
    """
    cursor = conexao.cursor()

    sql = """
        INSERT INTO leituras_plc
            (memoria_bool, memoria_int, memoria_float, memoria_string)
        VALUES (%s, %s, %s, %s)
    """

    dados = (
        valores.get("MEMORIA BOOL"),
        valores.get("MEMORIA INT"),
        round(valores.get("MEMORIA FLOAT", 0)) if valores.get("MEMORIA FLOAT") is not None else None,
        valores.get("MEMORIA STRING"),
    )

    cursor.execute(sql, dados)
    conexao.commit()

    print(f"✓ Leitura salva no banco (id {cursor.lastrowid}).")
    cursor.close()


def main():
    plc = conectar_plc()
    if not plc:
        print("Nao foi possivel conectar ao CLP. Abortando.")
        return

    valores = montar_valores(plc)
    plc.disconnect()

    if valores is None:
        print("Leitura do CLP falhou. Nada foi salvo no banco.")
        return

    print(f"Valores lidos: {valores}")

    conexao = conectar_mysql()
    if not conexao:
        print("Nao foi possivel conectar ao MySQL. Nada foi salvo.")
        return

    salvar_leitura(conexao, valores)
    conexao.close()


if __name__ == "__main__":
    main()