// ==========================================================
// tempo-parado.js
// Página "Tempo Parado": estado ao vivo + resumo agregado de
// paradas + gráfico de tempo parado por dia.
//
// Reaproveita /producao/status, /producao/paradas/resumo e
// /producao/historico/diario. Depende de js/common.js.
// ==========================================================

let filtroDataInicio = "";
let filtroDataFim = "";
let dadosDiarios = [];
let graficoTempoParado = null;


// ===============================
// ESTADO AO VIVO
// ===============================

async function buscarEstadoAoVivo() {
    const elParadaAtual = document.getElementById("parada-atual");

    try {
        const resposta = await fetch(`${API_URL}/producao/status`);
        const dados = await resposta.json();

        if (!dados.conectado) {
            elParadaAtual.textContent = "SEM CONEXÃO";
            elParadaAtual.style.color = "var(--red)";
            return;
        }

        if (dados.estado === "parada" && dados.parada_atual) {
            elParadaAtual.textContent = `PARADA HÁ ${formatarTempo(dados.parada_atual.duracao_segundos)}`;
            elParadaAtual.style.color = "var(--red)";
        } else if (dados.estado === "falha") {
            elParadaAtual.textContent = "MÁQUINA EM FALHA";
            elParadaAtual.style.color = "var(--red)";
        } else {
            elParadaAtual.textContent = "MÁQUINA RODANDO";
            elParadaAtual.style.color = "var(--green)";
        }

    } catch (erro) {
        console.error("Erro ao buscar estado ao vivo:", erro);
    }
}


// ===============================
// RESUMO DE PARADAS (histórico completo)
// ===============================

async function buscarResumoParadas() {
    try {
        const resposta = await fetch(`${API_URL}/producao/paradas/resumo`);
        const resumo = await resposta.json();

        document.getElementById("resumo-quantidade").textContent =
            formatarNumero(resumo.quantidade || 0);

        document.getElementById("resumo-tempo-total").textContent =
            formatarTempo(resumo.tempo_total_segundos || 0);

        document.getElementById("resumo-maior").textContent =
            formatarTempo(resumo.maior_parada_segundos || 0);

        document.getElementById("resumo-media").textContent =
            formatarTempo(resumo.media_segundos || 0);

    } catch (erro) {
        console.error("Erro ao buscar resumo de paradas:", erro);
    }
}


// ===============================
// GRÁFICO: TEMPO PARADO POR DIA
// ===============================

async function buscarTempoParadoDiario() {
    try {
        const params = new URLSearchParams();
        if (filtroDataInicio) params.set("data_inicio", filtroDataInicio);
        if (filtroDataFim) params.set("data_fim", filtroDataFim);

        const resposta = await fetch(`${API_URL}/producao/historico/diario?${params}`);
        const dados = await resposta.json();

        dadosDiarios = dados.sucesso ? (dados.dias || []) : [];
        desenharGrafico();

    } catch (erro) {
        console.error("Erro ao buscar tempo parado diário:", erro);
        dadosDiarios = [];
        desenharGrafico();
    }
}

function formatarDiaLabel(diaIso) {
    if (!diaIso) return "--";
    const [ano, mes, dia] = diaIso.split("-");
    return `${dia}/${mes}/${ano}`;
}

function desenharGrafico() {
    const canvas = document.getElementById("grafico-tempo-parado-dia");
    const cores = coresGrafico();

    if (graficoTempoParado) {
        graficoTempoParado.destroy();
        graficoTempoParado = null;
    }

    if (dadosDiarios.length === 0) return;

    const labels = dadosDiarios.map((d) => formatarDiaLabel(d.dia));
    const horasParado = dadosDiarios.map((d) => +(d.tempo_parado_dia / 3600).toFixed(2));

    graficoTempoParado = new Chart(canvas, {
        type: "bar",
        data: {
            labels,
            datasets: [
                {
                    label: "Tempo parado (h)",
                    data: horasParado,
                    backgroundColor: cores.red,
                    borderRadius: 4,
                    maxBarThickness: 34,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (contexto) => `${contexto.formattedValue} h paradas`,
                    },
                },
            },
            scales: {
                x: {
                    ticks: { color: cores.muted, font: { size: 10 } },
                    grid: { color: cores.grade },
                },
                y: {
                    beginAtZero: true,
                    ticks: { color: cores.muted, font: { size: 10 } },
                    grid: { color: cores.grade },
                },
            },
        },
    });
}

window.addEventListener("tema-alterado", () => {
    if (dadosDiarios.length > 0) {
        desenharGrafico();
    }
});


// ===============================
// FILTROS
// ===============================

document.getElementById("filtros-form").addEventListener("submit", (evento) => {
    evento.preventDefault();

    filtroDataInicio = document.getElementById("filtro-data-inicio").value;
    filtroDataFim = document.getElementById("filtro-data-fim").value;

    buscarTempoParadoDiario();
});

document.getElementById("botao-limpar-filtro").addEventListener("click", () => {
    document.getElementById("filtro-data-inicio").value = "";
    document.getElementById("filtro-data-fim").value = "";

    filtroDataInicio = "";
    filtroDataFim = "";

    buscarTempoParadoDiario();
});


// ===============================
// INICIALIZAÇÃO
// ===============================

buscarEstadoAoVivo();
buscarResumoParadas();
buscarTempoParadoDiario();

setInterval(buscarEstadoAoVivo, 5000);