// ==========================================================
// eficiencia.js
// Página "Eficiência": eficiência ao vivo + eficiência média do
// período + melhor/pior dia + gráfico de eficiência por dia +
// tabela de detalhamento.
//
// Reaproveita /producao/status e /producao/historico/diario —
// os mesmos endpoints que já alimentam as páginas de Tempo
// Parado e Produção por Dia. Depende de js/common.js.
// ==========================================================

let filtroDataInicio = "";
let filtroDataFim = "";
let dadosDiarios = [];
let graficoEficiencia = null;


// ===============================
// EFICIÊNCIA AO VIVO
// ===============================

async function buscarEficienciaAoVivo() {
    const elAoVivo = document.getElementById("eficiencia-ao-vivo");

    try {
        const resposta = await fetch(`${API_URL}/producao/status`);
        const dados = await resposta.json();

        if (!dados.conectado) {
            elAoVivo.textContent = "--";
            return;
        }

        const tempoRodando = dados.tempo_rodando_segundos || 0;
        const tempoParado = dados.tempo_parado_segundos || 0;
        const tempoTotal = tempoRodando + tempoParado;

        const eficiencia = tempoTotal > 0 ? (tempoRodando / tempoTotal) * 100 : 0;

        elAoVivo.textContent = `${eficiencia.toFixed(1)}%`;

    } catch (erro) {
        console.error("Erro ao buscar eficiência ao vivo:", erro);
    }
}


// ===============================
// HISTÓRICO DIÁRIO (resumo + gráfico + tabela)
// ===============================

async function buscarHistoricoDiario() {
    const corpo = document.getElementById("tabela-corpo");
    corpo.innerHTML = '<tr><td colspan="5" class="tabela-vazia">Carregando dados…</td></tr>';

    try {
        const params = new URLSearchParams();
        if (filtroDataInicio) params.set("data_inicio", filtroDataInicio);
        if (filtroDataFim) params.set("data_fim", filtroDataFim);

        const resposta = await fetch(`${API_URL}/producao/historico/diario?${params}`);
        const dados = await resposta.json();

        dadosDiarios = dados.sucesso ? (dados.dias || []) : [];

    } catch (erro) {
        console.error("Erro ao buscar histórico diário:", erro);
        dadosDiarios = [];
    }

    atualizarResumo();
    desenharGrafico();
    renderizarTabela();
}

function atualizarResumo() {
    const elMedia = document.getElementById("eficiencia-media");
    const elMelhorDia = document.getElementById("eficiencia-melhor-dia");
    const elMelhorValor = document.getElementById("eficiencia-melhor-valor");
    const elPiorValor = document.getElementById("eficiencia-pior-valor");

    if (dadosDiarios.length === 0) {
        elMedia.textContent = "0%";
        elMelhorDia.textContent = "--";
        elMelhorValor.textContent = "--";
        elPiorValor.textContent = "--";
        return;
    }

    const somaEficiencia = dadosDiarios.reduce((soma, d) => soma + (d.eficiencia_dia || 0), 0);
    const media = somaEficiencia / dadosDiarios.length;
    elMedia.textContent = `${media.toFixed(1)}%`;

    const melhor = dadosDiarios.reduce((a, b) => (b.eficiencia_dia > a.eficiencia_dia ? b : a));
    const pior = dadosDiarios.reduce((a, b) => (b.eficiencia_dia < a.eficiencia_dia ? b : a));

    elMelhorDia.textContent = formatarDiaLabel(melhor.dia);
    elMelhorValor.textContent = `${(melhor.eficiencia_dia || 0).toFixed(1)}%`;
    elPiorValor.textContent = `${(pior.eficiencia_dia || 0).toFixed(1)}%`;
}

function formatarDiaLabel(diaIso) {
    if (!diaIso) return "--";
    const [ano, mes, dia] = diaIso.split("-");
    return `${dia}/${mes}/${ano}`;
}


// ===============================
// GRÁFICO: EFICIÊNCIA POR DIA
// ===============================

function desenharGrafico() {
    const canvas = document.getElementById("grafico-eficiencia-dia");
    const cores = coresGrafico();

    if (graficoEficiencia) {
        graficoEficiencia.destroy();
        graficoEficiencia = null;
    }

    if (dadosDiarios.length === 0) return;

    const labels = dadosDiarios.map((d) => formatarDiaLabel(d.dia));
    const eficiencias = dadosDiarios.map((d) => d.eficiencia_dia || 0);

    graficoEficiencia = new Chart(canvas, {
        type: "bar",
        data: {
            labels,
            datasets: [
                {
                    label: "Eficiência (%)",
                    data: eficiencias,
                    backgroundColor: cores.cyan,
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
                        label: (contexto) => `${contexto.formattedValue}% de eficiência`,
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
                    max: 100,
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
// TABELA DE DETALHAMENTO
// ===============================

function renderizarTabela() {
    const corpo = document.getElementById("tabela-corpo");

    document.getElementById("tabela-contagem").textContent =
        `${formatarNumero(dadosDiarios.length)} DIA${dadosDiarios.length === 1 ? "" : "S"}`;

    if (dadosDiarios.length === 0) {
        corpo.innerHTML = '<tr><td colspan="5" class="tabela-vazia">Nenhum dado no período selecionado.</td></tr>';
        return;
    }

    // mais recente primeiro na tabela
    const ordenado = [...dadosDiarios].reverse();

    corpo.innerHTML = ordenado
        .map((d) => `
            <tr>
                <td>${formatarDiaLabel(d.dia)}</td>
                <td>${formatarNumero(d.producao_dia || 0)}</td>
                <td>${formatarTempo(d.tempo_rodando_dia || 0)}</td>
                <td>${formatarTempo(d.tempo_parado_dia || 0)}</td>
                <td>${(d.eficiencia_dia || 0).toFixed(1)}%</td>
            </tr>
        `)
        .join("");
}


// ===============================
// FILTROS
// ===============================

document.getElementById("filtros-form").addEventListener("submit", (evento) => {
    evento.preventDefault();

    filtroDataInicio = document.getElementById("filtro-data-inicio").value;
    filtroDataFim = document.getElementById("filtro-data-fim").value;

    buscarHistoricoDiario();
});

document.getElementById("botao-limpar-filtro").addEventListener("click", () => {
    document.getElementById("filtro-data-inicio").value = "";
    document.getElementById("filtro-data-fim").value = "";

    filtroDataInicio = "";
    filtroDataFim = "";

    buscarHistoricoDiario();
});


// ===============================
// INICIALIZAÇÃO
// ===============================

buscarEficienciaAoVivo();
buscarHistoricoDiario();

setInterval(buscarEficienciaAoVivo, 5000);