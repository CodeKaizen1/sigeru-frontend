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

// Popup de aviso simple (reemplaza el alert() nativo del navegador, que
// traba toda la pestaña -- un solo botón, sin "No"). Se arma su propio
// overlay (no reutiliza el de confirmar() porque puede necesitarse con uno
// ya abierto encima, por ejemplo validando un formulario dentro de otro modal).
let overlayAviso;
let elementoMensajeAviso;
let botonEntendidoAviso;

function asegurarModalAviso() {
    if (overlayAviso) return;

    overlayAviso = document.createElement("div");
    overlayAviso.className = "modal-overlay oculto";
    overlayAviso.innerHTML = `
        <div class="modal-card modal-confirmacion">
            <p class="modal-confirmacion-mensaje"></p>
            <div class="modal-actions">
                <button type="button" class="btn-principal" data-accion="entendido">Entendido</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlayAviso);

    elementoMensajeAviso = overlayAviso.querySelector(".modal-confirmacion-mensaje");
    botonEntendidoAviso = overlayAviso.querySelector('[data-accion="entendido"]');
}

// Muestra `mensaje` y devuelve una Promise<void> que resuelve al cerrarse
// (botón, click afuera o Escape). Pensado para reemplazar un alert(mensaje)
// tal cual, solo que sin bloquear el resto de la página mientras está abierto.
export function avisar(mensaje) {
    asegurarModalAviso();
    elementoMensajeAviso.textContent = mensaje;
    overlayAviso.classList.remove("oculto");
    botonEntendidoAviso.focus();

    return new Promise((resolve) => {
        function cerrar() {
            overlayAviso.classList.add("oculto");
            botonEntendidoAviso.removeEventListener("click", cerrar);
            overlayAviso.removeEventListener("click", alClickAfuera);
            document.removeEventListener("keydown", alTeclado);
            resolve();
        }

        function alClickAfuera(evento) {
            if (evento.target === overlayAviso) cerrar();
        }

        function alTeclado(evento) {
            if (evento.key === "Escape" || evento.key === "Enter") cerrar();
        }

        botonEntendidoAviso.addEventListener("click", cerrar);
        overlayAviso.addEventListener("click", alClickAfuera);
        document.addEventListener("keydown", alTeclado);
    });
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
            document.removeEventListener("keydown", alTeclado);
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

        // Punto 24 de la Fase 3 (auditoria 08/10/2026): avisar() ya cerraba
        // con Escape (ver mas arriba) pero a confirmar() le faltaba -- se
        // agrega acá con el mismo criterio que el click afuera (Escape =
        // "No", no asume que el usuario quiso confirmar).
        function alTeclado(evento) {
            if (evento.key === "Escape") cerrar(false);
        }

        botonAceptar.addEventListener("click", alAceptar);
        botonCancelar.addEventListener("click", alCancelar);
        overlay.addEventListener("click", alClickAfuera);
        document.addEventListener("keydown", alTeclado);
    });
}
