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

// Aplica o tema salvo (ou escuro, por padrão, na primeira visita)
aplicarTema(localStorage.getItem("industrial-monitor-tema") || "dark");


// ===============================
// CONFIGURAÇÃO
// ===============================

const API_URL = "http://127.0.0.1:8000";
const INTERVALO_ATUALIZACAO_MS = 5000; // 5 segundos

// Guarda o valor anterior de tempo rodando, para inferir se a máquina
// está rodando agora (o valor subiu desde a última leitura) ou parada.
let tempoRodandoAnterior = null;


// ===============================
// BUSCAR DADOS DA API
// ===============================

async function buscarDados() {
    try {
        const resposta = await fetch(`${API_URL}/plc/producao`);
        const json = await resposta.json();

        if (!json.conectado || !json.dados) {
            atualizarDashboardOffline();
            return;
        }

        const dados = {
            paletes: json.dados["ContagemPaletesProntos"] ?? 0,
            caixas: json.dados["ContagemCaixasPalete"] ?? 0,
            tempoParado: json.dados["TempoParado"] ?? 0,
            tempoRodando: json.dados["TempoRodando"] ?? 0,
        };

        atualizarDashboard(dados);

    } catch (erro) {
        console.error("Erro ao buscar dados da API:", erro);
        atualizarDashboardOffline();
    }
}


// ===============================
// FORMATAÇÃO DE TEMPO (segundos -> HH:MM:SS)
// ===============================

function formatarTempo(totalSegundos) {
    const horas = Math.floor(totalSegundos / 3600);
    const minutos = Math.floor((totalSegundos % 3600) / 60);
    const segundos = Math.floor(totalSegundos % 60);

    const pad = (n) => String(n).padStart(2, "0");

    return `${pad(horas)}:${pad(minutos)}:${pad(segundos)}`;
}


// ===============================
// ATUALIZA DASHBOARD (dados online)
// ===============================

function atualizarDashboard(dados) {

    document.getElementById("caixas").textContent =
        dados.caixas.toLocaleString("pt-BR");

    document.getElementById("paletes").textContent =
        dados.paletes.toLocaleString("pt-BR");

    document.getElementById("tempo-rodando").textContent =
        formatarTempo(dados.tempoRodando);


    // Máquina está "rodando" se o tempo rodando aumentou desde a última leitura.
    const rodando =
        tempoRodandoAnterior !== null && dados.tempoRodando > tempoRodandoAnterior;

    tempoRodandoAnterior = dados.tempoRodando;

    const estado = document.getElementById("estado");
    estado.textContent = rodando ? "PRODUZINDO" : "PARADA";
    estado.style.color = rodando ? "var(--green)" : "var(--muted)";


    // Tempo parado
    const motor = document.getElementById("motor");
    const motorDot = document.getElementById("motor-dot");

    motor.textContent = formatarTempo(dados.tempoParado);

    if (dados.tempoParado > 0) {
        motor.style.color = "var(--red)";
        motorDot.style.background = "var(--red)";
        motorDot.style.boxShadow = "0 0 12px var(--red)";
    } else {
        motor.style.color = "var(--green)";
        motorDot.style.background = "var(--green)";
        motorDot.style.boxShadow = "0 0 12px var(--green)";
    }


    // Eficiência = tempo rodando / (tempo rodando + tempo parado)
    const tempoTotal = dados.tempoRodando + dados.tempoParado;
    const eficiencia = tempoTotal > 0
        ? Math.round((dados.tempoRodando / tempoTotal) * 100)
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


    document.getElementById("plc-status").textContent = "ONLINE";

    atualizarHorario();
}


// ===============================
// ESTADO OFFLINE (CLP ou API fora do ar)
// ===============================

function atualizarDashboardOffline() {
    document.getElementById("plc-status").textContent = "OFFLINE";

    const estado = document.getElementById("estado");
    estado.textContent = "SEM CONEXÃO";
    estado.style.color = "var(--red)";

    atualizarHorario();
}


// ===============================
// HORÁRIO DA ÚLTIMA ATUALIZAÇÃO
// ===============================

function atualizarHorario() {
    const agora = new Date();
    const hora = agora.toLocaleTimeString("pt-BR");

    document.getElementById("last-update").textContent = hora;
}


// ===============================
// INICIALIZAÇÃO
// ===============================

buscarDados();
setInterval(buscarDados, INTERVALO_ATUALIZACAO_MS);