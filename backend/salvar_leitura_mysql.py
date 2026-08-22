"""
Le as variaveis de producao (DB5) no CLP e salva uma leitura (snapshot)
na tabela leituras_producao do MySQL.

Pre-requisitos:
- Tabela leituras_producao ja criada no banco siemens_plc_monitor.
- Comunicacao com o CLP ja validada.

Este script NAO altera main.py nem plc_connection.py.
"""

from plc_connection import conectar_plc
from mysql_connection import conectar_mysql
from plc_reader import VARIAVEIS_PRODUCAO, ler_variavel


def montar_valores(plc, variaveis):
    """
    Le cada variavel da lista e organiza os valores convertidos num
    dicionario simples, por nome. Retorna None se alguma leitura falhar.
    """
    valores = {}

    for var in variaveis:
        leitura = ler_variavel(plc, var)

        if not leitura["sucesso"]:
            print(f"✗ Falha ao ler '{var['nome']}': {leitura['erro']}")
            return None

        valores[var["nome"]] = leitura["valor_convertido"]

    return valores


def salvar_leitura_producao(conexao, valores):
    """
    Insere uma linha na tabela leituras_producao com os valores lidos.
    Espera as chaves: ContagemPaletesProntos, ContagemCaixasPalete,
    TempoParado, TempoRodando (nomes definidos em VARIAVEIS_PRODUCAO,
    em plc_reader.py).
    """
    cursor = conexao.cursor()

    sql = """
        INSERT INTO leituras_producao
            (contagem_paletes_prontos, contagem_caixas_palete, tempo_parado, tempo_rodando)
        VALUES (%s, %s, %s, %s)
    """

    dados = (
        valores.get("ContagemPaletesProntos"),
        valores.get("ContagemCaixasPalete"),
        valores.get("TempoParado"),
        valores.get("TempoRodando"),
    )

    cursor.execute(sql, dados)
    conexao.commit()

    print(f"✓ Leitura de produção salva no banco (id {cursor.lastrowid}).")
    cursor.close()


def main():
    plc = conectar_plc()
    if not plc:
        print("Nao foi possivel conectar ao CLP. Abortando.")
        return

    valores = montar_valores(plc, VARIAVEIS_PRODUCAO)
    plc.disconnect()

    if valores is None:
        print("Leitura do CLP falhou. Nada foi salvo no banco.")
        return

    print(f"Valores lidos: {valores}")

    conexao = conectar_mysql()
    if not conexao:
        print("Nao foi possivel conectar ao MySQL. Nada foi salvo.")
        return

    salvar_leitura_producao(conexao, valores)
    conexao.close()


if __name__ == "__main__":
    main()