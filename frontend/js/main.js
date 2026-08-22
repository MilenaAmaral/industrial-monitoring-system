// ===============================
// TEMA CLARO / ESCURO
// ===============================

const themeToggle = document.getElementById("theme-toggle");
const themeIcon = document.getElementById("theme-icon");

function aplicarTema(tema) {
    if (tema === "light") {
        document.body.classList.add("light-theme");
        themeIcon.textContent = "☀️";
    } else {
        document.body.classList.remove("light-theme");
        themeIcon.textContent = "🌙";
    }

    localStorage.setItem("industrial-monitor-tema", tema);
}

function alternarTema() {
    const temaAtual = document.body.classList.contains("light-theme") ? "light" : "dark";
    aplicarTema(temaAtual === "light" ? "dark" : "light");
}

themeToggle.addEventListener("click", alternarTema);
aplicarTema(localStorage.getItem("industrial-monitor-tema") || "dark");


// ===============================
// CONFIGURAÇÃO
// ===============================

const API_URL = "http://127.0.0.1:8000";
const INTERVALO_FETCH_MS = 5000;   // busca dados novos do CLP a cada 5s
const INTERVALO_TICK_MS = 1000;    // atualiza o relógio na tela a cada 1s

const CHAVE_PARADAS = "industrial-monitor-paradas";
const MAX_PARADAS_EXIBIDAS = 20;


// ===============================
// ESTADO INTERNO (memória local do dashboard)
// ===============================

// Ultimo valor bruto recebido do CLP (para detectar se avançou ou nao)
let ultimoTempoRodandoRaw = null;
let ultimoTempoParadoRaw = null;

// Base para o "relogio" contar sozinho entre uma busca e outra
let baseTempoRodando = 0;
let baseTempoParado = 0;
let baseTimestamp = Date.now();

// Estado atual da maquina: "rodando" | "parada" | null (ainda nao sabemos)
let estadoAtual = null;

// Controle do evento de parada em andamento
let paradaEmAndamento = null; // { inicioTempoParado, inicioHorario }

// Historico de paradas (persistido no navegador)
let historicoParadas = carregarParadas();


// ===============================
// PERSISTÊNCIA DO HISTÓRICO DE PARADAS
// ===============================

function carregarParadas() {
    try {
        const salvo = localStorage.getItem(CHAVE_PARADAS);
        return salvo ? JSON.parse(salvo) : [];
    } catch (erro) {
        console.error("Erro ao carregar histórico de paradas:", erro);
        return [];
    }
}

function salvarParadas() {
    localStorage.setItem(CHAVE_PARADAS, JSON.stringify(historicoParadas));
}


// ===============================
// FORMATAÇÃO DE TEMPO (segundos -> HH:MM:SS)
// ===============================

function formatarTempo(totalSegundos) {
    const seg = Math.max(0, Math.floor(totalSegundos));

    const horas = Math.floor(seg / 3600);
    const minutos = Math.floor((seg % 3600) / 60);
    const segundos = seg % 60;

    const pad = (n) => String(n).padStart(2, "0");

    return `${pad(horas)}:${pad(minutos)}:${pad(segundos)}`;
}


// ===============================
// BUSCAR DADOS DA API (a cada 5s)
// ===============================

async function buscarDados() {
    try {
        const resposta = await fetch(`${API_URL}/plc/producao`);
        const json = await resposta.json();

        if (!json.conectado || !json.dados) {
            marcarOffline();
            return;
        }

        const paletes = json.dados["ContagemPaletesProntos"] ?? 0;
        const caixas = json.dados["ContagemCaixasPalete"] ?? 0;
        const tempoParado = json.dados["TempoParado"] ?? 0;
        const tempoRodando = json.dados["TempoRodando"] ?? 0;

        document.getElementById("caixas").textContent = caixas.toLocaleString("pt-BR");
        document.getElementById("paletes").textContent = paletes.toLocaleString("pt-BR");
        document.getElementById("plc-status").textContent = "ONLINE";

        // Detecta o estado comparando com a ultima leitura bruta do CLP
        if (ultimoTempoRodandoRaw !== null) {
            const rodou = tempoRodando > ultimoTempoRodandoRaw;
            processarMudancaDeEstado(rodou ? "rodando" : "parada", tempoParado);
        }

        ultimoTempoRodandoRaw = tempoRodando;
        ultimoTempoParadoRaw = tempoParado;

        // Resincroniza a base do "relogio continuo" com o valor real do CLP
        baseTempoRodando = tempoRodando;
        baseTempoParado = tempoParado;
        baseTimestamp = Date.now();

        atualizarEficiencia();

    } catch (erro) {
        console.error("Erro ao buscar dados da API:", erro);
        marcarOffline();
    }
}


// ===============================
// TRATAR TRANSIÇÃO DE ESTADO (rodando <-> parada)
// ===============================

function processarMudancaDeEstado(novoEstado, tempoParadoAtual) {
    if (estadoAtual === novoEstado) {
        return; // nada mudou
    }

    // Rodando -> Parada: comeca uma nova parada
    if (novoEstado === "parada") {
        paradaEmAndamento = {
            inicioTempoParado: tempoParadoAtual,
            inicioHorario: new Date(),
        };
    }

    // Parada -> Rodando: fecha a parada e registra no historico
    if (novoEstado === "rodando" && paradaEmAndamento) {
        const duracao = tempoParadoAtual - paradaEmAndamento.inicioTempoParado;

        if (duracao > 0) {
            historicoParadas.unshift({
                horario: paradaEmAndamento.inicioHorario.toLocaleString("pt-BR"),
                duracaoSegundos: duracao,
            });

            salvarParadas();
            renderizarHistoricoParadas();
        }

        paradaEmAndamento = null;
    }

    estadoAtual = novoEstado;
    atualizarEstadoNaTela();
}


// ===============================
// RELÓGIO CONTÍNUO (a cada 1s, sem esperar o fetch)
// ===============================

function tick() {
    const decorridoSegundos = (Date.now() - baseTimestamp) / 1000;

    let tempoRodandoExibido = baseTempoRodando;
    let tempoParadoExibido = baseTempoParado;

    if (estadoAtual === "rodando") {
        tempoRodandoExibido += decorridoSegundos;
    } else if (estadoAtual === "parada") {
        tempoParadoExibido += decorridoSegundos;
    }

    document.getElementById("tempo-rodando").textContent = formatarTempo(tempoRodandoExibido);
    document.getElementById("motor").textContent = formatarTempo(tempoParadoExibido);

    atualizarHorario();
}


// ===============================
// ATUALIZAÇÕES VISUAIS AUXILIARES
// ===============================

function atualizarEstadoNaTela() {
    const estadoEl = document.getElementById("estado");
    const motorDot = document.getElementById("motor-dot");

    if (estadoAtual === "rodando") {
        estadoEl.textContent = "PRODUZINDO";
        estadoEl.style.color = "var(--green)";

        motorDot.style.background = "var(--green)";
        motorDot.style.boxShadow = "0 0 12px var(--green)";
        document.getElementById("motor").style.color = "var(--green)";

    } else if (estadoAtual === "parada") {
        estadoEl.textContent = "PARADA";
        estadoEl.style.color = "var(--red)";

        motorDot.style.background = "var(--red)";
        motorDot.style.boxShadow = "0 0 12px var(--red)";
        document.getElementById("motor").style.color = "var(--red)";
    }
}

function atualizarEficiencia() {
    const tempoTotal = baseTempoRodando + baseTempoParado;
    const eficiencia = tempoTotal > 0
        ? Math.round((baseTempoRodando / tempoTotal) * 100)
        : 0;

    const falha = document.getElementById("falha");
    const falhaDot = document.getElementById("falha-dot");

    falha.textContent = `${eficiencia}%`;

    if (eficiencia >= 70) {
        falha.style.color = "var(--green)";
        falhaDot.style.background = "var(--green)";
        falhaDot.style.boxShadow = "0 0 12px var(--green)";
    } else if (eficiencia >= 40) {
        falha.style.color = "var(--cyan)";
        falhaDot.style.background = "var(--cyan)";
        falhaDot.style.boxShadow = "0 0 12px var(--cyan)";
    } else {
        falha.style.color = "var(--red)";
        falhaDot.style.background = "var(--red)";
        falhaDot.style.boxShadow = "0 0 12px var(--red)";
    }
}

function atualizarHorario() {
    const agora = new Date();
    document.getElementById("last-update").textContent = agora.toLocaleTimeString("pt-BR");
}

function marcarOffline() {
    document.getElementById("plc-status").textContent = "OFFLINE";

    const estadoEl = document.getElementById("estado");
    estadoEl.textContent = "SEM CONEXÃO";
    estadoEl.style.color = "var(--red)";
}


// ===============================
// RENDERIZAR HISTÓRICO DE PARADAS
// ===============================

function renderizarHistoricoParadas() {
    document.getElementById("contador-paradas").textContent = historicoParadas.length;

    const lista = document.getElementById("stops-list");

    if (historicoParadas.length === 0) {
        lista.innerHTML = '<li class="stops-empty">Nenhuma parada registrada ainda.</li>';
        return;
    }

    lista.innerHTML = historicoParadas
        .slice(0, MAX_PARADAS_EXIBIDAS)
        .map((parada) => `
            <li>
                <span class="stop-time">${parada.horario}</span>
                <span class="stop-duration">${formatarTempo(parada.duracaoSegundos)}</span>
            </li>
        `)
        .join("");
}


// ===============================
// INICIALIZAÇÃO
// ===============================

renderizarHistoricoParadas();

buscarDados();
setInterval(buscarDados, INTERVALO_FETCH_MS);
setInterval(tick, INTERVALO_TICK_MS);