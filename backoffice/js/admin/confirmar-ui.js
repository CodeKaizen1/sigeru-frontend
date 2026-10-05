// CONFIRMACIÓN - UI compartida: popup propio (reemplaza el confirm() nativo del navegador).
// Funciones puras de DOM, no importan Model. El popup se arma una sola vez por página y se reutiliza.

let overlay;
let elementoMensaje;
let botonAceptar;
let botonCancelar;

function asegurarModal() {
    if (overlay) return;

    overlay = document.createElement("div");
    overlay.className = "modal-overlay oculto";
    overlay.innerHTML = `
        <div class="modal-card modal-confirmacion">
            <p class="modal-confirmacion-mensaje"></p>
            <div class="modal-actions">
                <button type="button" class="btn-secundario" data-accion="cancelar">No</button>
                <button type="button" class="btn-principal" data-accion="aceptar">Sí</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    elementoMensaje = overlay.querySelector(".modal-confirmacion-mensaje");
    botonAceptar = overlay.querySelector('[data-accion="aceptar"]');
    botonCancelar = overlay.querySelector('[data-accion="cancelar"]');
}

// Muestra el popup con `mensaje` y devuelve una Promise<boolean> (true = "Sí").
export function confirmar(mensaje) {
    asegurarModal();
    elementoMensaje.textContent = mensaje;
    overlay.classList.remove("oculto");

    return new Promise((resolve) => {
        function cerrar(resultado) {
            overlay.classList.add("oculto");
            botonAceptar.removeEventListener("click", alAceptar);
            botonCancelar.removeEventListener("click", alCancelar);
            overlay.removeEventListener("click", alClickAfuera);
            resolve(resultado);
        }

        function alAceptar() {
            cerrar(true);
        }

        function alCancelar() {
            cerrar(false);
        }

        function alClickAfuera(evento) {
            if (evento.target === overlay) cerrar(false);
        }

        botonAceptar.addEventListener("click", alAceptar);
        botonCancelar.addEventListener("click", alCancelar);
        overlay.addEventListener("click", alClickAfuera);
    });
}
