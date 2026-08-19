import snap7
from snap7.util import get_bool, get_int, get_dint, get_real, get_string

from plc_connection import conectar_plc


# ==========================================================
# LISTA DE VARIAVEIS - preencha com os enderecos reais do seu
# projeto no TIA Portal. Nao invente valores aqui.
# ==========================================================
VARIAVEIS = [
    {"nome": "MEMORIA BOOL",   "db": 1, "offset": 0, "bit": 0,    "tipo": "BOOL"},
    {"nome": "MEMORIA INT",    "db": 1, "offset": 2, "bit": None, "tipo": "INT"},
    {"nome": "MEMORIA FLOAT",  "db": 1, "offset": 4, "bit": None, "tipo": "REAL"},
    {"nome": "MEMORIA STRING", "db": 1, "offset": 8, "bit": None, "tipo": "STRING"},
]


# Tamanho em bytes que cada tipo ocupa na leitura (STRING tratado a parte)
TAMANHO_TIPO = {
    "BOOL": 1,
    "INT": 2,
    "DINT": 4,
    "REAL": 4,
}

STRING_MAX_LEN = 254  # tamanho maximo padrao de string no TIA Portal


def formatar_endereco(var):
    """Monta a notacao tipo DB1.DBW0 / DB1.DBX6.0 para exibicao."""
    db = var["db"]
    offset = var["offset"]
    tipo = var["tipo"]

    prefixos = {"BOOL": "DBX", "INT": "DBW", "DINT": "DBD", "REAL": "DBD", "STRING": "DBB"}
    prefixo = prefixos.get(tipo, "DB")

    if tipo == "BOOL":
        return f"DB{db}.{prefixo}{offset}.{var['bit']}"
    return f"DB{db}.{prefixo}{offset}"


def classificar_erro(erro):
    """
    Tenta identificar a categoria do erro a partir da excecao do snap7,
    para diferenciar: conexao, DB inexistente, endereco invalido,
    tipo incompativel, timeout ou erro generico de leitura.
    """
    msg = str(erro).lower()

    if "timeout" in msg or "winsock" in msg or "10060" in msg:
        return "TIMEOUT"
    if "not available" in msg or "object does not exist" in msg or "0x8500" in msg:
        return "DB_INEXISTENTE_OU_ENDERECO_INVALIDO"
    if "address out of range" in msg or "invalid address" in msg or "0xd6" in msg:
        return "ENDERECO_INVALIDO"
    if "connect" in msg or "connection" in msg:
        return "FALHA_DE_CONEXAO"
    return "ERRO_DE_LEITURA"


def ler_variavel(plc, var):
    """
    Le uma variavel individual do CLP.
    Retorna um dicionario com: valor_bruto, valor_convertido, sucesso, erro, categoria_erro
    """
    tipo = var["tipo"]
    db = var["db"]
    offset = var["offset"]

    resultado = {
        "valor_bruto": None,
        "valor_convertido": None,
        "sucesso": False,
        "erro": None,
        "categoria_erro": None,
    }

    # Validacao previa de tipo/bit (erro de configuracao, nao de comunicacao)
    if tipo == "BOOL" and var.get("bit") is None:
        resultado["erro"] = "Tipo BOOL requer o campo 'bit' definido."
        resultado["categoria_erro"] = "TIPO_INCOMPATIVEL"
        return resultado

    if tipo not in TAMANHO_TIPO and tipo != "STRING":
        resultado["erro"] = f"Tipo de dado nao suportado: {tipo}"
        resultado["categoria_erro"] = "TIPO_INCOMPATIVEL"
        return resultado

    try:
        if tipo == "STRING":
            tamanho_leitura = STRING_MAX_LEN + 2  # +2 bytes de cabecalho
        else:
            tamanho_leitura = TAMANHO_TIPO[tipo]

        data = plc.db_read(db, offset, tamanho_leitura)
        resultado["valor_bruto"] = data

        if tipo == "BOOL":
            resultado["valor_convertido"] = get_bool(data, 0, var["bit"])
        elif tipo == "INT":
            resultado["valor_convertido"] = get_int(data, 0)
        elif tipo == "DINT":
            resultado["valor_convertido"] = get_dint(data, 0)
        elif tipo == "REAL":
            resultado["valor_convertido"] = get_real(data, 0)
        elif tipo == "STRING":
            resultado["valor_convertido"] = get_string(data, 0)

        resultado["sucesso"] = True

    except Exception as erro:
        resultado["erro"] = str(erro)
        resultado["categoria_erro"] = classificar_erro(erro)

    return resultado


def executar_teste():
    print("=" * 40)
    print(" TESTE DE COMUNICAÇÃO - SIEMENS S7-1500")
    print("=" * 40)

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

    if not VARIAVEIS:
        print(
            "Nenhuma variavel configurada em VARIAVEIS ainda -\n"
            "a conexao com o CLP foi validada, mas nenhuma leitura foi feita.\n"
            "Preencha a lista no topo deste arquivo com nome, db, offset,\n"
            "bit (se BOOL) e tipo de cada memoria que deseja testar.\n"
        )
        plc.disconnect()
        print("=" * 40)
        print("RESULTADO DO TESTE")
        print("=" * 40)
        print("✓ Conexão: OK")
        print("- Leitura de variáveis: NÃO TESTADA (lista vazia)")
        print("\nConexão encerrada.")
        return

    resultados = []

    for i, var in enumerate(VARIAVEIS, start=1):
        endereco = formatar_endereco(var)
        leitura = ler_variavel(plc, var)

        print(f"[{i}] {var['nome']}")
        print(f"Endereço: {endereco}")
        print(f"Tipo: {var['tipo']}")

        if leitura["sucesso"]:
            if var["tipo"] == "STRING":
                # Para STRING, mostra so o valor convertido (sem o bytearray bruto com padding)
                print(f"Valor: {leitura['valor_convertido']}")
            elif var["tipo"] == "REAL":
                # REAL exibido como numero inteiro, sem casas decimais
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