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

// Descobre automaticamente o IP/host usado para acessar a página
// (ex: 192.168.0.15) e usa o mesmo endereço para falar com a API,
// que roda na porta 8000 no mesmo computador do backend/CLP.
// Assim, qualquer dispositivo na rede funciona sem editar nada aqui.
const API_URL = `http://${window.location.hostname}:8000`;
const INTERVALO_FETCH_MS = 5000;   // busca dados novos da API a cada 5s
const INTERVALO_TICK_MS = 1000;    // atualiza o relogio na tela a cada 1s


// ===============================
// ESTADO LOCAL (só para animar o relógio entre uma busca e outra -
// toda a logica de negocio/deteccao de parada vive no backend agora)
// ===============================

let baseTempoRodando = 0;
let baseTempoParado = 0;
let baseTimestamp = Date.now();
let estadoAtual = null; // "rodando" | "parada" | null


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

function formatarDataHora(isoString) {
    if (!isoString) return "--";
    const data = new Date(isoString);
    return data.toLocaleString("pt-BR");
}


// ===============================
// BUSCAR STATUS ATUAL DA PRODUÇÃO
// ===============================

async function buscarStatus() {
    try {
        const resposta = await fetch(`${API_URL}/producao/status`);
        const dados = await resposta.json();

        if (!dados.conectado) {
            marcarOffline();
            return;
        }

        document.getElementById("plc-status").textContent = "ONLINE";
        document.getElementById("caixas").textContent =
            dados.caixas_por_palete.toLocaleString("pt-BR");
        document.getElementById("paletes").textContent =
            dados.paletes_prontos.toLocaleString("pt-BR");

        document.getElementById("contador-paradas").textContent = dados.quantidade_paradas;

        estadoAtual = dados.estado;

        baseTempoRodando = dados.tempo_rodando_segundos;
        baseTempoParado = dados.parada_atual
            ? dados.parada_atual.duracao_segundos
            : 0;
        baseTimestamp = Date.now();

        atualizarEstadoNaTela();

    } catch (erro) {
        console.error("Erro ao buscar status da produção:", erro);
        marcarOffline();
    }
}


// ===============================
// BUSCAR HISTÓRICO E RESUMO DE PARADAS
// ===============================

async function buscarHistoricoParadas() {
    try {
        const [respPar, respResumo] = await Promise.all([
            fetch(`${API_URL}/producao/paradas?limite=20`),
            fetch(`${API_URL}/producao/paradas/resumo`),
        ]);

        const { paradas } = await respPar.json();
        const resumo = await respResumo.json();

        renderizarHistoricoParadas(paradas, resumo);

    } catch (erro) {
        console.error("Erro ao buscar histórico de paradas:", erro);
    }
}

function renderizarHistoricoParadas(paradas, resumo) {
    document.getElementById("maior-parada").textContent =
        formatarTempo(resumo.maior_parada_segundos || 0);

    document.getElementById("media-parada").textContent =
        formatarTempo(resumo.media_segundos || 0);

    const lista = document.getElementById("stops-list");

    if (!paradas || paradas.length === 0) {
        lista.innerHTML = '<li class="stops-empty">Nenhuma parada registrada ainda.</li>';
        return;
    }

    lista.innerHTML = paradas
        .map((parada) => {
            const duracao = parada.duracao_segundos !== null
                ? formatarTempo(parada.duracao_segundos)
                : "EM ANDAMENTO";

            return `
                <li>
                    <span class="stop-time">
                        ${formatarDataHora(parada.inicio)} → ${formatarDataHora(parada.fim)}
                    </span>
                    <span class="stop-duration">${duracao}</span>
                </li>
            `;
        })
        .join("");
}


// ===============================
// BUSCAR ALARMES DO SISTEMA
// ===============================

// Nomes tecnicos (vindos do CLP) -> texto amigavel para exibir.
// Conforme mais alarmes forem cadastrados no backend, basta
// adicionar a traducao aqui.
const NOMES_ALARMES = {
    SistemaDesligado: "Sistema Desligado",
    EmergenciaAcionada: "Emergência Acionada",
    SistemaEmManual: "Sistema em Manual",
};

async function buscarAlarmes() {
    try {
        const resposta = await fetch(`${API_URL}/plc/alarmes`);
        const dados = await resposta.json();

        if (!dados.conectado) {
            return;
        }

        renderizarAlarmes(dados.alarmes || {}, dados.algum_ativo);

    } catch (erro) {
        console.error("Erro ao buscar alarmes:", erro);
    }
}

function renderizarAlarmes(alarmes, algumAtivo) {
    const statusEl = document.getElementById("alarmes-status");
    const lista = document.getElementById("alarmes-list");

    const ativos = Object.entries(alarmes).filter(([, valor]) => valor === true);

    if (algumAtivo) {
        statusEl.textContent = "ALERTA";
        statusEl.style.color = "var(--red)";
    } else {
        statusEl.textContent = "OK";
        statusEl.style.color = "var(--green)";
    }

    if (ativos.length === 0) {
        lista.innerHTML = '<li class="stops-empty">Nenhum alarme ativo.</li>';
        return;
    }

    lista.innerHTML = ativos
        .map(([nomeTecnico]) => {
            const nomeAmigavel = NOMES_ALARMES[nomeTecnico] || nomeTecnico;
            return `
                <li>
                    <span class="stop-time">${nomeAmigavel}</span>
                    <span class="stop-duration" style="color: var(--red)">ATIVO</span>
                </li>
            `;
        })
        .join("");
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
    const motorTexto = document.getElementById("motor");

    if (estadoAtual === "rodando") {
        estadoEl.textContent = "PRODUZINDO";
        estadoEl.style.color = "var(--green)";

        motorDot.style.background = "var(--green)";
        motorDot.style.boxShadow = "0 0 12px var(--green)";
        motorTexto.style.color = "var(--green)";

    } else if (estadoAtual === "parada") {
        estadoEl.textContent = "PARADA";
        estadoEl.style.color = "var(--red)";

        motorDot.style.background = "var(--red)";
        motorDot.style.boxShadow = "0 0 12px var(--red)";
        motorTexto.style.color = "var(--red)";
    }

    atualizarEficiencia();
}

function atualizarEficiencia() {
    const tempoTotal = baseTempoRodando + (estadoAtual === "parada" ? baseTempoParado : 0);
    const eficiencia = baseTempoRodando + baseTempoParado > 0
        ? Math.round((baseTempoRodando / (baseTempoRodando + baseTempoParado)) * 100)
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
// INICIALIZAÇÃO
// ===============================

buscarStatus();
buscarHistoricoParadas();
buscarAlarmes();

setInterval(buscarStatus, INTERVALO_FETCH_MS);
setInterval(buscarHistoricoParadas, INTERVALO_FETCH_MS);
setInterval(buscarAlarmes, INTERVALO_FETCH_MS);
setInterval(tick, INTERVALO_TICK_MS);