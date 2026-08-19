const dadosPLC = {
    velocidade: 1452,
    producao: 121,
    contador: 121,
    estado: "PRODUZINDO",
    motor: true,
    falha: false,
    online: true
};


// ===============================
// ATUALIZA DASHBOARD
// ===============================

function atualizarDashboard(dados) {

    document.getElementById("velocidade").textContent =
        dados.velocidade.toLocaleString("pt-BR");

    document.getElementById("producao").textContent =
        dados.producao.toLocaleString("pt-BR");

    document.getElementById("contador").textContent =
        dados.contador.toLocaleString("pt-BR");


    document.getElementById("estado").textContent =
        dados.estado;


    const motor = document.getElementById("motor");
    const motorDot = document.getElementById("motor-dot");

    if (dados.motor) {

        motor.textContent = "LIGADO";

        motor.style.color = "var(--green)";

        motorDot.style.background = "var(--green)";
        motorDot.style.boxShadow = "0 0 12px var(--green)";

    } else {

        motor.textContent = "DESLIGADO";

        motor.style.color = "var(--muted)";

        motorDot.style.background = "var(--muted)";
        motorDot.style.boxShadow = "none";

    }


    const falha = document.getElementById("falha");
    const falhaDot = document.getElementById("falha-dot");

    if (dados.falha) {

        falha.textContent = "FAULT";

        falha.style.color = "var(--red)";

        falhaDot.style.background = "var(--red)";
        falhaDot.style.boxShadow = "0 0 12px var(--red)";

    } else {

        falha.textContent = "NO FAULT";

        falha.style.color = "var(--green)";

        falhaDot.style.background = "var(--green)";
        falhaDot.style.boxShadow = "0 0 12px var(--green)";

    }


    const plcStatus = document.getElementById("plc-status");

    plcStatus.textContent =
        dados.online ? "ONLINE" : "OFFLINE";


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

atualizarDashboard(dadosPLC);