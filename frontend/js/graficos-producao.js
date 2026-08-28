// ==========================================================
// graficos-producao.js
// Página "Gráficos de Produção por Dia": consome
// /producao/historico/diario e desenha 2 gráficos (Chart.js)
// + uma tabela de apoio com os mesmos dados.
//
// Depende de js/common.js (API_URL, formatarTempo, coresGrafico)
// e da biblioteca Chart.js vendorizada em js/vendor/.
// ==========================================================

let filtroDataInicio = "";
let filtroDataFim = "";
let dadosDiarios = [];

let graficoProducao = null;
let graficoTempo = null;


// ===============================
// BUSCA DE DADOS
// ===============================

async function buscarProducaoDiaria() {
    const corpo = document.getElementById("tabela-corpo");
    corpo.innerHTML = '<tr><td colspan="6" class="tabela-vazia">Carregando dados…</td></tr>';

    try {
        const params = new URLSearchParams();
        if (filtroDataInicio) params.set("data_inicio", filtroDataInicio);
        if (filtroDataFim) params.set("data_fim", filtroDataFim);

        const resposta = await fetch(`${API_URL}/producao/historico/diario?${params}`);
        const dados = await resposta.json();

        if (!dados.sucesso) {
            corpo.innerHTML = `<tr><td colspan="6" class="tabela-vazia">Erro: ${dados.mensagem}</td></tr>`;
            dadosDiarios = [];
            desenharGraficos();
            return;
        }

        dadosDiarios = dados.dias || [];

        renderizarTabela(dadosDiarios);
        desenharGraficos();

    } catch (erro) {
        console.error("Erro ao buscar produção diária:", erro);
        corpo.innerHTML = '<tr><td colspan="6" class="tabela-vazia">Não foi possível carregar os dados. Verifique se a API está no ar.</td></tr>';
        dadosDiarios = [];
        desenharGraficos();
    }
}


// ===============================
// TABELA DE APOIO
// ===============================

function renderizarTabela(dias) {
    const corpo = document.getElementById("tabela-corpo");

    document.getElementById("tabela-contagem").textContent =
        `${formatarNumero(dias.length)} DIA${dias.length === 1 ? "" : "S"}`;

    if (!dias || dias.length === 0) {
        corpo.innerHTML = '<tr><td colspan="6" class="tabela-vazia">Nenhuma leitura encontrada para o período selecionado.</td></tr>';
        return;
    }

    // mais recente primeiro na tabela
    const ordenado = [...dias].reverse();

    corpo.innerHTML = ordenado
        .map((dia) => `
            <tr>
                <td>${formatarDiaLabel(dia.dia)}</td>
                <td>${formatarNumero(dia.producao_dia)}</td>
                <td>${formatarTempo(dia.tempo_rodando_dia)}</td>
                <td>${formatarTempo(dia.tempo_parado_dia)}</td>
                <td>${dia.eficiencia_dia}%</td>
                <td>${formatarNumero(dia.quantidade_leituras)}</td>
            </tr>
        `)
        .join("");
}

function formatarDiaLabel(diaIso) {
    if (!diaIso) return "--";
    const [ano, mes, dia] = diaIso.split("-");
    return `${dia}/${mes}/${ano}`;
}


// ===============================
// GRÁFICOS (Chart.js)
// ===============================

function desenharGraficos() {
    const cores = coresGrafico();
    const labels = dadosDiarios.map((d) => formatarDiaLabel(d.dia));

    desenharGraficoProducao(cores, labels);
    desenharGraficoTempo(cores, labels);
}

function opcoesBase(cores, formatarTooltip) {
    return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                labels: { color: cores.muted, font: { size: 10 } },
            },
            tooltip: {
                callbacks: formatarTooltip ? { label: formatarTooltip } : undefined,
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
    };
}

function desenharGraficoProducao(cores, labels) {
    const canvas = document.getElementById("grafico-producao-dia");

    if (graficoProducao) {
        graficoProducao.destroy();
        graficoProducao = null;
    }

    if (dadosDiarios.length === 0) {
        return;
    }

    graficoProducao = new Chart(canvas, {
        type: "bar",
        data: {
            labels,
            datasets: [
                {
                    label: "Paletes prontos",
                    data: dadosDiarios.map((d) => d.producao_dia),
                    backgroundColor: cores.cyan,
                    borderRadius: 4,
                    maxBarThickness: 36,
                },
            ],
        },
        options: opcoesBase(cores),
    });
}

function desenharGraficoTempo(cores, labels) {
    const canvas = document.getElementById("grafico-tempo-dia");

    if (graficoTempo) {
        graficoTempo.destroy();
        graficoTempo = null;
    }

    if (dadosDiarios.length === 0) {
        return;
    }

    // convertidos para horas, para o eixo Y ficar legivel
    const rodandoHoras = dadosDiarios.map((d) => +(d.tempo_rodando_dia / 3600).toFixed(2));
    const paradoHoras = dadosDiarios.map((d) => +(d.tempo_parado_dia / 3600).toFixed(2));

    graficoTempo = new Chart(canvas, {
        type: "bar",
        data: {
            labels,
            datasets: [
                {
                    label: "Rodando (h)",
                    data: rodandoHoras,
                    backgroundColor: cores.green,
                    borderRadius: 4,
                    maxBarThickness: 30,
                },
                {
                    label: "Parado (h)",
                    data: paradoHoras,
                    backgroundColor: cores.red,
                    borderRadius: 4,
                    maxBarThickness: 30,
                },
            ],
        },
        options: {
            ...opcoesBase(cores, (contexto) => `${contexto.dataset.label}: ${contexto.formattedValue} h`),
            scales: {
                x: {
                    stacked: true,
                    ticks: { color: cores.muted, font: { size: 10 } },
                    grid: { color: cores.grade },
                },
                y: {
                    stacked: true,
                    beginAtZero: true,
                    ticks: { color: cores.muted, font: { size: 10 } },
                    grid: { color: cores.grade },
                },
            },
        },
    });
}

// Redesenha os gráficos com as novas cores quando o tema muda
// (disparado por js/common.js).
window.addEventListener("tema-alterado", () => {
    if (dadosDiarios.length > 0) {
        desenharGraficos();
    }
});


// ===============================
// FILTROS
// ===============================

document.getElementById("filtros-form").addEventListener("submit", (evento) => {
    evento.preventDefault();

    filtroDataInicio = document.getElementById("filtro-data-inicio").value;
    filtroDataFim = document.getElementById("filtro-data-fim").value;

    buscarProducaoDiaria();
});

document.getElementById("botao-limpar-filtro").addEventListener("click", () => {
    document.getElementById("filtro-data-inicio").value = "";
    document.getElementById("filtro-data-fim").value = "";

    filtroDataInicio = "";
    filtroDataFim = "";

    buscarProducaoDiaria();
});


// ===============================
// INICIALIZAÇÃO
// ===============================

buscarProducaoDiaria();