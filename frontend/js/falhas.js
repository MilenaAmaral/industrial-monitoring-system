// ==========================================================
// falhas.js
// Página "Falhas / Alarmes": resumo + 2 gráficos (Chart.js) +
// histórico completo, reaproveitando /producao/status,
// /producao/alarmes e /producao/alarmes/resumo — os mesmos
// endpoints que já alimentam o Dashboard.
//
// Depende de js/common.js (API_URL, formatarTempo,
// nomeAmigavelAlarme, coresGrafico) e da Chart.js vendorizada.
// ==========================================================

const LIMITE_HISTORICO = 100;

let graficoOcorrencias = null;
let graficoTempoAlarme = null;
let ultimoResumo = [];


// ===============================
// RESUMO (ativos agora + agregados por alarme)
// ===============================

async function buscarResumoAtivos() {
    try {
        const resposta = await fetch(`${API_URL}/producao/status`);
        const dados = await resposta.json();

        const ativos = dados.alarmes_ativos || [];

        document.getElementById("resumo-ativos").textContent = ativos.length;

        const statusEl = document.getElementById("resumo-ativos-status");
        if (ativos.length > 0) {
            statusEl.textContent = ativos.map((a) => nomeAmigavelAlarme(a.nome)).join(", ");
            statusEl.style.color = "var(--red)";
        } else {
            statusEl.textContent = "NENHUM ALARME ATIVO";
            statusEl.style.color = "var(--green)";
        }

    } catch (erro) {
        console.error("Erro ao buscar alarmes ativos:", erro);
    }
}

async function buscarResumoAlarmes() {
    try {
        const resposta = await fetch(`${API_URL}/producao/alarmes/resumo`);
        const { resumo } = await resposta.json();

        ultimoResumo = resumo || [];

        document.getElementById("resumo-tipos").textContent = ultimoResumo.length;

        const tempoTotal = ultimoResumo.reduce(
            (soma, item) => soma + (item.tempo_total_segundos || 0),
            0
        );
        document.getElementById("resumo-tempo-total").textContent = formatarTempo(tempoTotal);

        desenharGraficos();

    } catch (erro) {
        console.error("Erro ao buscar resumo de alarmes:", erro);
    }
}


// ===============================
// GRÁFICOS (Chart.js)
// ===============================

function desenharGraficos() {
    const cores = coresGrafico();

    // ordena do alarme com mais ocorrencias para o com menos
    const ordenado = [...ultimoResumo].sort((a, b) => b.quantidade - a.quantidade);
    const labels = ordenado.map((item) => nomeAmigavelAlarme(item.nome_alarme));

    desenharGraficoOcorrencias(cores, labels, ordenado);
    desenharGraficoTempoAlarme(cores, labels, ordenado);
}

function opcoesBase(cores) {
    return {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: "y",
        plugins: {
            legend: { display: false },
        },
        scales: {
            x: {
                beginAtZero: true,
                ticks: { color: cores.muted, font: { size: 10 } },
                grid: { color: cores.grade },
            },
            y: {
                ticks: { color: cores.muted, font: { size: 10 } },
                grid: { display: false },
            },
        },
    };
}

function desenharGraficoOcorrencias(cores, labels, dados) {
    const canvas = document.getElementById("grafico-ocorrencias");

    if (graficoOcorrencias) {
        graficoOcorrencias.destroy();
        graficoOcorrencias = null;
    }

    if (dados.length === 0) return;

    graficoOcorrencias = new Chart(canvas, {
        type: "bar",
        data: {
            labels,
            datasets: [
                {
                    label: "Ocorrências",
                    data: dados.map((item) => item.quantidade),
                    backgroundColor: cores.cyan,
                    borderRadius: 4,
                    maxBarThickness: 26,
                },
            ],
        },
        options: opcoesBase(cores),
    });
}

function desenharGraficoTempoAlarme(cores, labels, dados) {
    const canvas = document.getElementById("grafico-tempo-alarme");

    if (graficoTempoAlarme) {
        graficoTempoAlarme.destroy();
        graficoTempoAlarme = null;
    }

    if (dados.length === 0) return;

    graficoTempoAlarme = new Chart(canvas, {
        type: "bar",
        data: {
            labels,
            datasets: [
                {
                    label: "Minutos",
                    data: dados.map((item) => +(item.tempo_total_segundos / 60).toFixed(1)),
                    backgroundColor: cores.red,
                    borderRadius: 4,
                    maxBarThickness: 26,
                },
            ],
        },
        options: opcoesBase(cores),
    });
}

window.addEventListener("tema-alterado", () => {
    if (ultimoResumo.length > 0) {
        desenharGraficos();
    }
});


// ===============================
// TABELA (histórico completo)
// ===============================

async function buscarHistoricoAlarmes() {
    const corpo = document.getElementById("tabela-corpo");
    corpo.innerHTML = '<tr><td colspan="5" class="tabela-vazia">Carregando alarmes…</td></tr>';

    try {
        const resposta = await fetch(`${API_URL}/producao/alarmes?limite=${LIMITE_HISTORICO}`);
        const { alarmes } = await resposta.json();

        renderizarTabela(alarmes || []);

        document.getElementById("tabela-contagem").textContent =
            `${formatarNumero((alarmes || []).length)} EVENTO${(alarmes || []).length === 1 ? "" : "S"}`;

    } catch (erro) {
        console.error("Erro ao buscar histórico de alarmes:", erro);
        corpo.innerHTML = '<tr><td colspan="5" class="tabela-vazia">Não foi possível carregar o histórico. Verifique se a API está no ar.</td></tr>';
    }
}

function renderizarTabela(alarmes) {
    const corpo = document.getElementById("tabela-corpo");

    if (!alarmes || alarmes.length === 0) {
        corpo.innerHTML = '<tr><td colspan="5" class="tabela-vazia">Nenhum alarme registrado ainda.</td></tr>';
        return;
    }

    corpo.innerHTML = alarmes
        .map((alarme) => {
            const emAndamento = alarme.duracao_segundos === null || alarme.fim === null;

            const duracao = emAndamento
                ? "EM ANDAMENTO"
                : formatarTempo(alarme.duracao_segundos);

            const statusHtml = emAndamento
                ? '<span style="color: var(--red);">● ATIVO</span>'
                : '<span style="color: var(--green);">● ENCERRADO</span>';

            return `
                <tr>
                    <td>${nomeAmigavelAlarme(alarme.nome_alarme)}</td>
                    <td>${formatarDataHora(alarme.inicio)}</td>
                    <td>${emAndamento ? "--" : formatarDataHora(alarme.fim)}</td>
                    <td style="${emAndamento ? "color: var(--red);" : ""}">${duracao}</td>
                    <td>${statusHtml}</td>
                </tr>
            `;
        })
        .join("");
}


// ===============================
// INICIALIZAÇÃO
// ===============================

buscarResumoAtivos();
buscarResumoAlarmes();
buscarHistoricoAlarmes();

setInterval(buscarResumoAtivos, 5000);