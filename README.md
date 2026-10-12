# Industrial Monitoring System

Sistema de monitoramento industrial que lê dados de um **CLP Siemens S7-1500**, grava o histórico em **MySQL** e exibe produção, paradas, alarmes e eficiência em um painel web acessível pela rede local.

> Projeto pessoal, desenvolvido para estudo e portfólio. **Status: em desenvolvimento.**

## O problema

Em uma linha automatizada, as informações de produção ficam dentro do CLP e só aparecem na IHM da máquina. Sem histórico, fica difícil responder perguntas simples: quanto foi produzido por dia, quanto tempo a máquina ficou parada e qual alarme causou cada parada.

## Como funciona

```text
CLP Siemens S7-1500 ──(python-snap7)──> Backend Python (FastAPI)
                                              │
                                              ├── loop automático: lê o CLP em intervalos
                                              │   e registra leituras, paradas e alarmes
                                              ▼
                                         MySQL / MariaDB
                                              │
                                              ▼
                                   API REST (JSON) ──> Painel web (HTML, CSS, JavaScript, Chart.js)
```

1. O backend conecta ao CLP com `python-snap7` e lê variáveis de Data Blocks (produção e alarmes).
2. Um loop em background salva snapshots periódicos em `leituras_producao` e abre/fecha eventos em `eventos_parada` e `eventos_alarme`.
3. A API REST expõe o estado atual e o histórico.
4. O painel web consome a API e mostra os indicadores, atualizando automaticamente.

## Funcionalidades

- Status de conexão com o CLP e da produção em tempo real
- Contadores de produção lidos do CLP
- Registro de paradas com duração e motivo (correlação com alarmes ativos)
- Histórico de alarmes com resumo por tipo
- Histórico de produção com filtro por período e produção diária
- Páginas do painel: Dashboard, Histórico de Produção, Produção por Dia (gráficos), Paradas, Tempo Parado, Falhas/Alarmes e Eficiência
- Configuração por variáveis de ambiente (`.env`), sem IP ou senha no código

## Tecnologias

| Camada | Tecnologias |
| --- | --- |
| Comunicação com CLP | Python, python-snap7 |
| Back-end / API | FastAPI, Uvicorn, python-dotenv |
| Banco de dados | MySQL / MariaDB, mysql-connector-python |
| Front-end | HTML5, CSS3, JavaScript, Chart.js |

## Endpoints principais

| Método | Rota | Descrição |
| --- | --- | --- |
| GET | `/plc/status` | Testa a conexão com o CLP |
| GET | `/plc/producao` | Lê as variáveis de produção do CLP |
| GET | `/plc/alarmes` | Lê os alarmes do CLP |
| POST | `/plc/salvar` | Grava uma leitura manual no banco |
| GET | `/producao/status` | Estado atual da produção |
| GET | `/producao/paradas` e `/producao/paradas/resumo` | Histórico e resumo de paradas |
| GET | `/producao/alarmes` e `/producao/alarmes/resumo` | Histórico e resumo de alarmes |
| GET | `/producao/historico`, `/producao/historico/resumo`, `/producao/historico/diario` | Histórico de produção |

Com a API rodando, a documentação interativa fica em `http://localhost:8000/docs`.

## Estrutura

```text
industrial-monitoring-system/
├── backend/
│   ├── main.py                  # API FastAPI e rotas
│   ├── plc_connection.py        # conexão com o CLP
│   ├── plc_reader.py            # mapeamento e leitura das variáveis (Data Blocks)
│   ├── automacao.py             # loop de leitura automática em background
│   ├── paradas.py / alarmes.py  # abertura e fechamento de eventos
│   ├── historico.py             # consultas de histórico e produção diária
│   ├── mysql_connection.py
│   ├── salvar_leitura_mysql.py
│   ├── teste_comunicacao_plc.py # teste rápido de comunicação com o CLP
│   ├── requirements.txt
│   └── .env.example
├── frontend/                    # painel web (páginas, CSS e JS)
├── iniciar_backend.bat
├── iniciar_frontend.bat
└── iniciar_tudo.bat
```

## Como executar (Windows)

Pré-requisitos: Python 3, MySQL ou MariaDB, e acesso de rede a um CLP S7-1500 (com acesso PUT/GET habilitado no TIA Portal).

```bash
git clone https://github.com/MilenaAmaral/industrial-monitoring-system.git
cd industrial-monitoring-system
python -m venv .venv
.venv\Scripts\activate
pip install -r backend/requirements.txt
copy backend\.env.example backend\.env   # preencha IP do CLP e dados do banco
```

Crie o banco definido em `DB_NAME` com as tabelas `leituras_producao`, `eventos_parada` e `eventos_alarme`.

Depois, execute `iniciar_tudo.bat`. Ele abre o backend (porta 8000) e o painel (porta 8080) e mostra o endereço para acessar o painel de outro dispositivo da rede.

## Próximos passos

- Script SQL de criação das tabelas
- Execução multiplataforma (além dos scripts .bat)
- Testes automatizados para as regras de parada e alarme
- Capturas de tela do painel neste README

## Autora

**Milena Amaral Dias**, estudante de Engenharia de Software.
[LinkedIn](https://www.linkedin.com/in/milenaamaraldias/) · [GitHub](https://github.com/MilenaAmaral)
