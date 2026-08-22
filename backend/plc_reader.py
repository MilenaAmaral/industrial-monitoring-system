from snap7.util import get_bool, get_int, get_dint, get_real, get_string


# ==========================================================
# LISTA DE VARIÁVEIS
# ==========================================================

VARIAVEIS = [
    {
        "nome": "MEMORIA BOOL",
        "db": 1,
        "offset": 0,
        "bit": 0,
        "tipo": "BOOL"
    },
    {
        "nome": "MEMORIA INT",
        "db": 1,
        "offset": 2,
        "bit": None,
        "tipo": "INT"
    },
    {
        "nome": "MEMORIA FLOAT",
        "db": 1,
        "offset": 4,
        "bit": None,
        "tipo": "REAL"
    },
    {
        "nome": "MEMORIA STRING",
        "db": 1,
        "offset": 8,
        "bit": None,
        "tipo": "STRING"
    },
]

# Variaveis reais de producao - DB5 "Producao"
# (Optimized block access deve estar desabilitado nessa DB tambem)
VARIAVEIS_PRODUCAO = [
    {
        "nome": "ContagemPaletesProntos",
        "db": 5,
        "offset": 0,
        "bit": None,
        "tipo": "DINT"
    },
    {
        "nome": "ContagemCaixasPalete",
        "db": 5,
        "offset": 4,
        "bit": None,
        "tipo": "DINT"
    },
    {
        "nome": "TempoParado",
        "db": 5,
        "offset": 8,
        "bit": None,
        "tipo": "DINT"
    },
    {
        "nome": "TempoRodando",
        "db": 5,
        "offset": 12,
        "bit": None,
        "tipo": "DINT"
    },
]


# Tamanho em bytes que cada tipo ocupa na leitura.
# STRING é tratado separadamente.

TAMANHO_TIPO = {
    "BOOL": 1,
    "INT": 2,
    "DINT": 4,
    "REAL": 4,
}

STRING_MAX_LEN = 254


def formatar_endereco(var):
    """Monta a notação do endereço para exibição."""

    db = var["db"]
    offset = var["offset"]
    tipo = var["tipo"]

    prefixos = {
        "BOOL": "DBX",
        "INT": "DBW",
        "DINT": "DBD",
        "REAL": "DBD",
        "STRING": "DBB"
    }

    prefixo = prefixos.get(tipo, "DB")

    if tipo == "BOOL":
        return f"DB{db}.{prefixo}{offset}.{var['bit']}"

    return f"DB{db}.{prefixo}{offset}"


def classificar_erro(erro):
    """
    Classifica erros de leitura do Snap7.
    """

    msg = str(erro).lower()

    if "timeout" in msg or "winsock" in msg or "10060" in msg:
        return "TIMEOUT"

    if (
        "not available" in msg
        or "object does not exist" in msg
        or "0x8500" in msg
    ):
        return "DB_INEXISTENTE_OU_ENDERECO_INVALIDO"

    if (
        "address out of range" in msg
        or "invalid address" in msg
        or "0xd6" in msg
    ):
        return "ENDERECO_INVALIDO"

    if "connect" in msg or "connection" in msg:
        return "FALHA_DE_CONEXAO"

    return "ERRO_DE_LEITURA"


def ler_variavel(plc, var):
    """
    Lê uma variável individual do CLP.

    Retorna:
        valor_bruto
        valor_convertido
        sucesso
        erro
        categoria_erro
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

    # Validação de configuração do BOOL.

    if tipo == "BOOL" and var.get("bit") is None:
        resultado["erro"] = (
            "Tipo BOOL requer o campo 'bit' definido."
        )
        resultado["categoria_erro"] = "TIPO_INCOMPATIVEL"
        return resultado

    # Validação do tipo.

    if tipo not in TAMANHO_TIPO and tipo != "STRING":
        resultado["erro"] = (
            f"Tipo de dado nao suportado: {tipo}"
        )
        resultado["categoria_erro"] = "TIPO_INCOMPATIVEL"
        return resultado

    try:

        if tipo == "STRING":
            tamanho_leitura = STRING_MAX_LEN + 2
        else:
            tamanho_leitura = TAMANHO_TIPO[tipo]

        data = plc.db_read(
            db,
            offset,
            tamanho_leitura
        )

        resultado["valor_bruto"] = data

        if tipo == "BOOL":
            resultado["valor_convertido"] = get_bool(
                data,
                0,
                var["bit"]
            )

        elif tipo == "INT":
            resultado["valor_convertido"] = get_int(
                data,
                0
            )

        elif tipo == "DINT":
            resultado["valor_convertido"] = get_dint(
                data,
                0
            )

        elif tipo == "REAL":
            resultado["valor_convertido"] = get_real(
                data,
                0
            )

        elif tipo == "STRING":
            resultado["valor_convertido"] = get_string(
                data,
                0
            )

        resultado["sucesso"] = True

    except Exception as erro:

        resultado["erro"] = str(erro)
        resultado["categoria_erro"] = classificar_erro(
            erro
        )

    return resultado