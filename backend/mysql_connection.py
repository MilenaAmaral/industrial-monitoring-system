import os

import mysql.connector
from mysql.connector import Error
from dotenv import load_dotenv

load_dotenv()


DB_HOST = os.getenv("DB_HOST", "127.0.0.1")
DB_PORT = int(os.getenv("DB_PORT", "3306"))
DB_USER = os.getenv("DB_USER", "root")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_NAME = os.getenv("DB_NAME", "siemens_plc_monitor")


def conectar_mysql():
    """
    Abre uma conexao com o banco MySQL/MariaDB.
    Retorna o objeto de conexao em caso de sucesso, ou None em caso de falha.
    """
    print("Conectando ao MySQL...")

    try:
        conexao = mysql.connector.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD,
            database=DB_NAME,
        )

        if conexao.is_connected():
            print("MySQL conectado com sucesso!")
            return conexao

        print("Nao foi possivel conectar ao MySQL.")
        return None

    except Error as erro:
        print(f"Erro ao conectar ao MySQL: {erro}")
        return None