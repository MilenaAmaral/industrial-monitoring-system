// ==========================================================
// paradas.js
// Lógica da página "Histórico de Paradas": resumo agregado e
// tabela com as paradas mais recentes, reaproveitando os
// endpoints /producao/paradas e /producao/paradas/resumo (os
// mesmos que já alimentam o painel Dashboard).
//
// Depende de funções/constantes definidas em js/common.js.
// ==========================================================

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

async function buscarListaParadas() {
    const corpo = document.getElementById("tabela-corpo");
    corpo.innerHTML = '<tr><td colspan="5" class="tabela-vazia">Carregando paradas…</td></tr>';

    const limite = document.getElementById("filtro-limite").value;

    try {
        const resposta = await fetch(`${API_URL}/producao/paradas?limite=${limite}`);
        const { paradas } = await resposta.json();

        renderizarTabela(paradas || []);

        document.getElementById("tabela-contagem").textContent =
            `${formatarNumero((paradas || []).length)} EVENTO${(paradas || []).length === 1 ? "" : "S"}`;

    } catch (erro) {
        console.error("Erro ao buscar histórico de paradas:", erro);
        corpo.innerHTML = '<tr><td colspan="5" class="tabela-vazia">Não foi possível carregar o histórico. Verifique se a API está no ar.</td></tr>';
    }
}

function renderizarMotivo(motivo) {
    if (!motivo) {
        return '<span style="color: var(--muted);">Sem alarme associado</span>';
    }

    return motivo
        .split(",")
        .map((nomeTecnico) => nomeAmigavelAlarme(nomeTecnico))
        .join(", ");
}

function renderizarTabela(paradas) {
    const corpo = document.getElementById("tabela-corpo");

    if (!paradas || paradas.length === 0) {
        corpo.innerHTML = '<tr><td colspan="5" class="tabela-vazia">Nenhuma parada registrada ainda.</td></tr>';
        return;
    }

    corpo.innerHTML = paradas
        .map((parada) => {
            const emAndamento = parada.duracao_segundos === null || parada.fim === null;

            const duracao = emAndamento
                ? "EM ANDAMENTO"
                : formatarTempo(parada.duracao_segundos);

            const statusHtml = emAndamento
                ? '<span style="color: var(--red);">● EM ANDAMENTO</span>'
                : '<span style="color: var(--green);">● CONCLUÍDA</span>';

            return `
                <tr>
                    <td>${formatarDataHora(parada.inicio)}</td>
                    <td>${emAndamento ? "--" : formatarDataHora(parada.fim)}</td>
                    <td style="${emAndamento ? "color: var(--red);" : ""}">${duracao}</td>
                    <td>${renderizarMotivo(parada.motivo)}</td>
                    <td>${statusHtml}</td>
                </tr>
            `;
        })
        .join("");
}

// ===============================
// FILTRO
// ===============================

document.getElementById("filtros-form").addEventListener("submit", (evento) => {
    evento.preventDefault();
    buscarListaParadas();
});

// ===============================
// INICIALIZAÇÃO
// ===============================

buscarResumoParadas();
buscarListaParadas();