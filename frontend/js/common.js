// ==========================================================
// COMMON.JS
// Codigo compartilhado por todas as paginas do painel: tema
// claro/escuro, relogio local em tempo real, configuracao da
// API e helpers de formatacao.
// ==========================================================


// ===============================
// TEMA CLARO / ESCURO
// ===============================

(function () {
    const toggle = document.getElementById("theme-toggle");
    const icon = document.getElementById("theme-icon");

    function aplicarTema(tema) {
        if (tema === "light") {
            document.body.classList.add("light-theme");
            if (icon) icon.textContent = "☀️";
        } else {
            document.body.classList.remove("light-theme");
            if (icon) icon.textContent = "🌙";
        }

        localStorage.setItem("industrial-monitor-tema", tema);
    }

    function alternarTema() {
        const temaAtual = document.body.classList.contains("light-theme") ? "light" : "dark";
        aplicarTema(temaAtual === "light" ? "dark" : "light");
    }

    if (toggle) {
        toggle.addEventListener("click", alternarTema);
    }

    aplicarTema(localStorage.getItem("industrial-monitor-tema") || "dark");
})();


// ===============================
// CONFIGURAÇÃO DA API
// ===============================

const API_URL = `http://${window.location.hostname}:8000`;


// ===============================
// FORMATAÇÃO (compartilhada entre páginas)
// ===============================

function formatarTempo(totalSegundos) {
    const seg = Math.max(0, Math.floor(totalSegundos || 0));

    const horas = Math.floor(seg / 3600);
    const minutos = Math.floor((seg % 3600) / 60);
    const segundos = seg % 60;

    const pad = (n) => String(n).padStart(2, "0");

    return `${pad(horas)}:${pad(minutos)}:${pad(segundos)}`;
}

function formatarDataHora(isoString) {
    if (!isoString) return "--";
    const data = new Date(isoString);
    if (isNaN(data.getTime())) return "--";
    return data.toLocaleString("pt-BR");
}

function formatarData(isoString) {
    if (!isoString) return "--";
    const data = new Date(isoString);
    if (isNaN(data.getTime())) return "--";
    return data.toLocaleDateString("pt-BR");
}

function formatarNumero(valor) {
    if (valor === null || valor === undefined) return "0";
    return Number(valor).toLocaleString("pt-BR");
}


// ===============================
// RELÓGIO LOCAL EM TEMPO REAL (topo de todas as páginas)
// ===============================

function atualizarRelogioLocal() {
    const agora = new Date();

    const elHora = document.getElementById("relogio-hora");
    const elData = document.getElementById("relogio-data");

    if (elHora) {
        elHora.textContent = agora.toLocaleTimeString("pt-BR");
    }

    if (elData) {
        const diaSemana = agora
            .toLocaleDateString("pt-BR", { weekday: "short" })
            .replace(".", "");
        const dataFormatada = agora.toLocaleDateString("pt-BR");

        elData.textContent = `${diaSemana}, ${dataFormatada}`;
    }
}

atualizarRelogioLocal();
setInterval(atualizarRelogioLocal, 1000);