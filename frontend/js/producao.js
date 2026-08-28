// ==========================================================
// producao.js
// Lógica da página "Histórico de Produção": filtro por data,
// resumo do período e tabela paginada de leituras, consumindo
// os endpoints /producao/historico e /producao/historico/resumo.
//
// Depende de funções/constantes definidas em js/common.js
// (API_URL, formatarTempo, formatarDataHora), incluído antes
// deste arquivo no producao.html.
// ==========================================================

const POR_PAGINA = 25;

let paginaAtual = 1;
let totalPaginas = 1;
let filtroDataInicio = "";
let filtroDataFim = "";


// ===============================
// RESUMO DO PERÍODO
// ===============================

async function buscarResumoPeriodo() {
    try {
        const params = new URLSearchParams();
        if (filtroDataInicio) params.set("data_inicio", filtroDataInicio);
        if (filtroDataFim) params.set("data_fim", filtroDataFim);

        const resposta = await fetch(`${API_URL}/producao/historico/resumo?${params}`);
        const dados = await resposta.json();

        if (!dados.sucesso) {
            console.error("Falha ao buscar resumo do período:", dados.mensagem);
            return;
        }

        document.getElementById("resumo-producao").textContent =
            formatarNumero(dados.producao_periodo);

        document.getElementById("resumo-tempo-rodando").textContent =
            formatarTempo(dados.tempo_rodando_periodo);

        document.getElementById("resumo-tempo-parado").textContent =
            formatarTempo(dados.tempo_parado_periodo);

        const elIntervalo = document.getElementById("resumo-intervalo");

        if (dados.primeira_leitura && dados.ultima_leitura) {
            elIntervalo.textContent =
                `${formatarData(dados.primeira_leitura)} → ${formatarData(dados.ultima_leitura)}`;
        } else {
            elIntervalo.textContent = "SEM LEITURAS NO PERÍODO";
        }

    } catch (erro) {
        console.error("Erro ao buscar resumo do período:", erro);
    }
}


// ===============================
// TABELA DE LEITURAS (paginada)
// ===============================

async function buscarLeituras() {
    const corpo = document.getElementById("tabela-corpo");
    corpo.innerHTML = '<tr><td colspan="5" class="tabela-vazia">Carregando leituras…</td></tr>';

    try {
        const params = new URLSearchParams({
            pagina: paginaAtual,
            por_pagina: POR_PAGINA,
        });
        if (filtroDataInicio) params.set("data_inicio", filtroDataInicio);
        if (filtroDataFim) params.set("data_fim", filtroDataFim);

        const resposta = await fetch(`${API_URL}/producao/historico?${params}`);
        const dados = await resposta.json();

        if (!dados.sucesso) {
            corpo.innerHTML = `<tr><td colspan="5" class="tabela-vazia">Erro: ${dados.mensagem}</td></tr>`;
            atualizarPaginacao(0, 1, 1);
            return;
        }

        renderizarTabela(dados.leituras || []);
        atualizarPaginacao(dados.total || 0, dados.pagina || 1, dados.total_paginas || 1);

    } catch (erro) {
        console.error("Erro ao buscar histórico de leituras:", erro);
        corpo.innerHTML = '<tr><td colspan="5" class="tabela-vazia">Não foi possível carregar o histórico. Verifique se a API está no ar.</td></tr>';
    }
}

function renderizarTabela(leituras) {
    const corpo = document.getElementById("tabela-corpo");

    if (!leituras || leituras.length === 0) {
        corpo.innerHTML = '<tr><td colspan="5" class="tabela-vazia">Nenhuma leitura encontrada para o período selecionado.</td></tr>';
        return;
    }

    corpo.innerHTML = leituras
        .map((leitura) => `
            <tr>
                <td>${formatarDataHora(leitura.data_hora)}</td>
                <td>${formatarNumero(leitura.contagem_paletes_prontos)}</td>
                <td>${formatarNumero(leitura.contagem_caixas_palete)}</td>
                <td>${formatarTempo(leitura.tempo_rodando)}</td>
                <td>${formatarTempo(leitura.tempo_parado)}</td>
            </tr>
        `)
        .join("");
}

function atualizarPaginacao(total, pagina, totalPag) {
    paginaAtual = pagina;
    totalPaginas = totalPag;

    document.getElementById("tabela-contagem").textContent =
        `${formatarNumero(total)} LEITURA${total === 1 ? "" : "S"}`;

    document.getElementById("paginacao-info").textContent =
        total > 0
            ? `Mostrando página ${pagina} de ${totalPag} (${formatarNumero(total)} leituras no total)`
            : "Nenhuma leitura para exibir";

    document.getElementById("pagina-atual-label").textContent = `Página ${pagina} de ${totalPag}`;

    document.getElementById("pagina-anterior").disabled = pagina <= 1;
    document.getElementById("pagina-proxima").disabled = pagina >= totalPag;
}


// ===============================
// FILTROS
// ===============================

document.getElementById("filtros-form").addEventListener("submit", (evento) => {
    evento.preventDefault();

    filtroDataInicio = document.getElementById("filtro-data-inicio").value;
    filtroDataFim = document.getElementById("filtro-data-fim").value;
    paginaAtual = 1;

    buscarResumoPeriodo();
    buscarLeituras();
});

document.getElementById("botao-limpar-filtro").addEventListener("click", () => {
    document.getElementById("filtro-data-inicio").value = "";
    document.getElementById("filtro-data-fim").value = "";

    filtroDataInicio = "";
    filtroDataFim = "";
    paginaAtual = 1;

    buscarResumoPeriodo();
    buscarLeituras();
});


// ===============================
// PAGINAÇÃO (botões)
// ===============================

document.getElementById("pagina-anterior").addEventListener("click", () => {
    if (paginaAtual > 1) {
        paginaAtual -= 1;
        buscarLeituras();
    }
});

document.getElementById("pagina-proxima").addEventListener("click", () => {
    if (paginaAtual < totalPaginas) {
        paginaAtual += 1;
        buscarLeituras();
    }
});


// ===============================
// INICIALIZAÇÃO
// ===============================

buscarResumoPeriodo();
buscarLeituras();