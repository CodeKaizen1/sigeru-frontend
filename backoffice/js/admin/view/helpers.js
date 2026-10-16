// Punto 27 de la Fase 4 (16/10/2026): view.js se separó en archivos propios
// por tema -- este es el único sin dependencias internas (no importa de
// ningún otro archivo de view/), la base sobre la que se apoyan todos los
// demás: utilidades genéricas de texto/fecha/HTML y el buscador por texto
// que reusan casi todos los módulos (listado, detalle, formularios).

export function claseEstado(estado) {
    return estado
        .toLowerCase()
        .replaceAll(" ", "-")
        .replaceAll("_", "-");
}

// Escapa caracteres especiales de HTML para evitar XSS al insertar datos variables.
export function escapeHtml(valor) {
    return String(valor ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

// Formatea una fecha ISO a texto legible; devuelve "Sin datos" si no hay fecha o es inválida.
export function formatearFechaHora(iso) {
    if (!iso) return "Sin datos";

    const fecha = new Date(iso);
    if (isNaN(fecha.getTime())) return "Sin datos";

    const fechaTexto = fecha.toLocaleDateString("es-UY");
    const horaTexto = fecha.toLocaleTimeString("es-UY", { hour: "2-digit", minute: "2-digit" });
    return `${fechaTexto} a las ${horaTexto}`;
}

export function crearDetalleItem(titulo, valor) {
    return `
        <div class="detail-item">
            <span>${titulo}</span>
            <strong>${escapeHtml(valor)}</strong>
        </div>
    `;
}

// Arma <option> a partir de una lista; textoBusqueda (opcional) define el texto
// filtrable por activarBuscador(). Si el item trae _otraCuadrilla (ver
// Model.obtenerJefesDisponibles/obtenerChoferesDisponibles), la opción suma
// "— cuadrilla X" al final - mismo número de cuadrilla que ya se usa en la
// etiqueta de Operarios (ver construirCamposCuadrillaHtml). Se probó resaltar
// además la opción en amarillo, pero quedaba raro dentro de un <select>
// nativo (su render ya depende del navegador/SO, no del resto del sitio) -
// a pedido de Matías (14/10) se dejó solo el texto, sin color.
// Export (no privada, a diferencia del view.js original): la necesita
// formularios.js (construirCamposCuadrillaHtml).
export function crearOpciones(lista, idSeleccionado, etiqueta, textoBusqueda) {
    return lista.map((item) => {
        const atributoBusqueda = textoBusqueda
            ? ` data-busqueda="${escapeHtml(normalizarBusqueda(textoBusqueda(item)))}"`
            : "";
        const otraCuadrilla = item._otraCuadrilla;
        const sufijoCuadrilla = otraCuadrilla ? ` — cuadrilla ${escapeHtml(otraCuadrilla.id)}` : "";

        return `
        <option value="${item.id}"${atributoBusqueda} ${item.id === idSeleccionado ? "selected" : ""}>${escapeHtml(etiqueta(item))}${sufijoCuadrilla}</option>
    `;
    }).join("");
}

// Normaliza a minúsculas para comparar en el buscador. Export (no privada,
// a diferencia del view.js original): la necesita formularios.js
// (construirCamposCuadrillaHtml, renderContenedoresRuta), además de acá mismo.
export function normalizarBusqueda(texto) {
    return texto.toString().toLowerCase();
}

// Filtra elementos con data-busqueda (options, labels, etc.) según lo escrito en el input.
export function activarBuscador(inputId, itemsSelector) {
    const input = document.getElementById(inputId);
    if (!input) return;

    // Evita que Enter dentro del buscador envíe el formulario que lo contiene.
    input.addEventListener("keydown", (evento) => {
        if (evento.key === "Enter") evento.preventDefault();
    });

    input.addEventListener("input", () => {
        const texto = normalizarBusqueda(input.value);
        document.querySelectorAll(itemsSelector).forEach((item) => {
            const coincide = !texto || (item.dataset.busqueda || "").includes(texto);
            item.style.display = coincide ? "" : "none";
        });
    });
}
