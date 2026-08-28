// ===============================
// CONFIGURAÇÃO
// (tema claro/escuro, relógio local, API_URL, formatarTempo e
// formatarDataHora agora vêm de js/common.js, incluído antes
// deste arquivo no index.html)
// ===============================

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
// BUSCAR STATUS ATUAL DA PRODUÇÃO
// ===============================

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

        document.getElementById("plc-status").textContent = "CONECTADO";
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
        atualizarAlarmesAtivos(dados.alarmes_ativos || []);

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
// ALARMES DO SISTEMA (com contabilização de tempo, salvos no banco)
// NOMES_ALARMES vem de js/common.js (compartilhado com a página de
// Histórico de Paradas).
// ===============================

// Nome tecnico do alarme que deve disparar a notificacao especial
// (som + banner + notificacao do navegador).
const ALARME_EMERGENCIA = "EmergenciaAcionada";

let emergenciaAtiva = false;

// Atualiza o badge "ALERTA/OK" com base no que veio de /producao/status
// (dados.alarmes_ativos) e decide se precisa disparar/parar a notificacao
// de emergencia. E chamada a cada 5s, junto do buscarStatus.
function atualizarAlarmesAtivos(alarmesAtivos) {
    const statusEl = document.getElementById("alarmes-status");

    if (alarmesAtivos.length > 0) {
        statusEl.textContent = "ALERTA";
        statusEl.style.color = "var(--red)";
    } else {
        statusEl.textContent = "OK";
        statusEl.style.color = "var(--green)";
    }

    const temEmergencia = alarmesAtivos.some((a) => a.nome === ALARME_EMERGENCIA);

    if (temEmergencia && !emergenciaAtiva) {
        emergenciaAtiva = true;
        emergenciaSilenciada = false;
        dispararEmergencia();
    } else if (!temEmergencia && emergenciaAtiva) {
        emergenciaAtiva = false;
        pararEmergencia();
    }
}

function dispararEmergencia() {
    const banner = document.getElementById("emergencia-banner");
    banner.hidden = false;

    iniciarBeepContinuo();

    if ("Notification" in window) {
        if (Notification.permission === "granted") {
            new Notification("🚨 Emergência acionada", {
                body: "A emergência foi acionada no CLP. Verifique a máquina imediatamente.",
                requireInteraction: true,
            });
        } else if (Notification.permission !== "denied") {
            Notification.requestPermission();
        }
    }
}

function pararEmergencia() {
    const banner = document.getElementById("emergencia-banner");
    banner.hidden = true;
    pararBeepContinuo();
}

// Gera um "beep" com Web Audio API (sem precisar de nenhum arquivo de
// som externo) e repete em loop enquanto a emergencia estiver ativa.
function tocarBeep() {
    try {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }

        const oscilador = audioCtx.createOscillator();
        const ganho = audioCtx.createGain();

        oscilador.type = "square";
        oscilador.frequency.value = 880;
        ganho.gain.value = 0.15;

        oscilador.connect(ganho);
        ganho.connect(audioCtx.destination);

        oscilador.start();
        oscilador.stop(audioCtx.currentTime + 0.35);
    } catch (erro) {
        console.error("Erro ao tocar som de alerta:", erro);
    }
}

function iniciarBeepContinuo() {
    if (beepIntervalId || emergenciaSilenciada) return;

    tocarBeep();
    beepIntervalId = setInterval(tocarBeep, 800);
}

function pararBeepContinuo() {
    if (beepIntervalId) {
        clearInterval(beepIntervalId);
        beepIntervalId = null;
    }
}

document.getElementById("emergencia-silenciar").addEventListener("click", () => {
    emergenciaSilenciada = true;
    pararBeepContinuo();
});

// Pede permissao de notificacao assim que a pagina carrega, para que o
// navegador ja esteja autorizado quando uma emergencia real acontecer.
if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
}


// ===============================
// HISTÓRICO DE ALARMES (lista + resumo, vindos do banco)
// ===============================

async function buscarHistoricoAlarmes() {
    try {
        const [respAlarmes, respResumo] = await Promise.all([
            fetch(`${API_URL}/producao/alarmes?limite=20`),
            fetch(`${API_URL}/producao/alarmes/resumo`),
        ]);

        const { alarmes } = await respAlarmes.json();
        const { resumo } = await respResumo.json();

        renderizarHistoricoAlarmes(alarmes, resumo);

    } catch (erro) {
        console.error("Erro ao buscar histórico de alarmes:", erro);
    }
}

function renderizarHistoricoAlarmes(alarmes, resumo) {
    const lista = document.getElementById("alarmes-list");

    if (!alarmes || alarmes.length === 0) {
        lista.innerHTML = '<li class="stops-empty">Nenhum alarme registrado ainda.</li>';
        return;
    }

    lista.innerHTML = alarmes
        .map((alarme) => {
            const nomeAmigavel = NOMES_ALARMES[alarme.nome_alarme] || alarme.nome_alarme;
            const emAndamento = alarme.duracao_segundos === null;

            const duracao = emAndamento
                ? "EM ANDAMENTO"
                : formatarTempo(alarme.duracao_segundos);

            const fimTexto = emAndamento ? "agora" : formatarDataHora(alarme.fim);

            return `
                <li>
                    <span class="stop-time">
                        ${nomeAmigavel} · ${formatarDataHora(alarme.inicio)} → ${fimTexto}
                    </span>
                    <span class="stop-duration" style="${emAndamento ? "color: var(--red)" : ""}">
                        ${duracao}
                    </span>
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

    } else if (estadoAtual === "falha") {
        estadoEl.textContent = "EM FALHA";
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
    document.getElementById("plc-status").textContent = "SEM CONEXÃO";

    const estadoEl = document.getElementById("estado");
    estadoEl.textContent = "SEM CONEXÃO";
    estadoEl.style.color = "var(--red)";
}
