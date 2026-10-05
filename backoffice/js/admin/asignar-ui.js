// POPUP DE ASIGNACIÓN RÁPIDA / TEXTO CORTO
// Mismo patrón que confirmar-ui.js, con un <select> (pedirSeleccion) o un <textarea> (pedirTexto)
// adentro. Evita abrir el formulario largo de alta/edición solo para cambiar un dato puntual.

let overlay;
let tituloEl;
let etiquetaEl;
let campoSelect;
let campoTexto;
let errorEl;
let botonGuardar;
let botonCancelar;

function asegurarModal() {
    if (overlay) return;

    overlay = document.createElement("div");
    overlay.className = "modal-overlay oculto";
    overlay.innerHTML = `
        <div class="modal-card modal-asignacion">
            <h3 class="modal-asignacion-titulo"></h3>

            <div class="grupo-formulario">
                <label class="modal-asignacion-etiqueta"></label>
                <select class="modal-asignacion-select"></select>
                <textarea class="modal-asignacion-textarea oculto" rows="4"></textarea>
                <span class="modal-asignacion-error oculto"></span>
            </div>

            <div class="modal-actions">
                <button type="button" class="btn-secundario" data-accion="cancelar">Cancelar</button>
                <button type="button" class="btn-principal" data-accion="guardar">Guardar</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    tituloEl = overlay.querySelector(".modal-asignacion-titulo");
    etiquetaEl = overlay.querySelector(".modal-asignacion-etiqueta");
    campoSelect = overlay.querySelector(".modal-asignacion-select");
    campoTexto = overlay.querySelector(".modal-asignacion-textarea");
    errorEl = overlay.querySelector(".modal-asignacion-error");
    botonGuardar = overlay.querySelector('[data-accion="guardar"]');
    botonCancelar = overlay.querySelector('[data-accion="cancelar"]');
}

// Devuelve una Promise con el valor elegido/escrito, o null si se canceló.
function abrir({ titulo, etiqueta, modo, opciones = [], valorActual = "", placeholder = "", valorInicial = "", requerido = false }) {
    asegurarModal();

    tituloEl.textContent = titulo;
    etiquetaEl.textContent = etiqueta;
    errorEl.classList.add("oculto");
    errorEl.textContent = "";

    if (modo === "select") {
        campoSelect.classList.remove("oculto");
        campoTexto.classList.add("oculto");
        campoSelect.innerHTML = opciones
            .map((opcion) => `<option value="${opcion.value}" ${opcion.value === (valorActual || "") ? "selected" : ""}>${opcion.label}</option>`)
            .join("");
    } else {
        campoTexto.classList.remove("oculto");
        campoSelect.classList.add("oculto");
        campoTexto.value = valorInicial || "";
        campoTexto.placeholder = placeholder || "";
    }

    overlay.classList.remove("oculto");
    (modo === "select" ? campoSelect : campoTexto).focus();

    return new Promise((resolve) => {
        function cerrar(resultado) {
            overlay.classList.add("oculto");
            botonGuardar.removeEventListener("click", alGuardar);
            botonCancelar.removeEventListener("click", alCancelar);
            overlay.removeEventListener("click", alClickAfuera);
            campoTexto.removeEventListener("keydown", alTecleoTextoArea);
            resolve(resultado);
        }

        function alGuardar() {
            const valor = modo === "select" ? campoSelect.value : campoTexto.value.trim();

            if (requerido && !valor) {
                errorEl.textContent = "Este dato es obligatorio.";
                errorEl.classList.remove("oculto");
                return;
            }

            cerrar(valor);
        }

        function alCancelar() {
            cerrar(null);
        }

        function alClickAfuera(evento) {
            if (evento.target === overlay) cerrar(null);
        }

        // Enter en el textarea no envía (deja escribir varias líneas); Ctrl+Enter sí guarda.
        function alTecleoTextoArea(evento) {
            if (evento.key === "Enter" && (evento.ctrlKey || evento.metaKey)) {
                evento.preventDefault();
                alGuardar();
            }
        }

        botonGuardar.addEventListener("click", alGuardar);
        botonCancelar.addEventListener("click", alCancelar);
        overlay.addEventListener("click", alClickAfuera);
        campoTexto.addEventListener("keydown", alTecleoTextoArea);
    });
}

// Popup con un <select>. opciones: [{ value, label }, ...].
export function pedirSeleccion(titulo, etiqueta, opciones, valorActual) {
    return abrir({ titulo, etiqueta, modo: "select", opciones, valorActual, requerido: false });
}

// Popup con un <textarea>.
export function pedirTexto(titulo, etiqueta, { placeholder = "", valorInicial = "", requerido = true } = {}) {
    return abrir({ titulo, etiqueta, modo: "texto", placeholder, valorInicial, requerido });
}
