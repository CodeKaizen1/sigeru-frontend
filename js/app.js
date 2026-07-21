//
// LANDING - FORMULARIO DE INCIDENCIAS
// Simulación de envío (todavía no hay backend conectado)
//

document.addEventListener("DOMContentLoaded", () => {
    const formulario = document.getElementById("formIncidencia");

    if (!formulario) return;

    const aviso = document.getElementById("avisoIncidencia");
    const mensajeInicial = aviso ? aviso.textContent : "";

    formulario.addEventListener("submit", (evento) => {
        evento.preventDefault();

        if (aviso) {
            aviso.textContent = "¡Gracias! Tu aviso fue registrado.";
            aviso.classList.add("aviso-formulario-exito");
        }

        formulario.reset();

        setTimeout(() => {
            if (aviso) {
                aviso.textContent = mensajeInicial;
                aviso.classList.remove("aviso-formulario-exito");
            }
        }, 4000);
    });
});
