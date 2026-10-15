// MAPA DE RUTA (panel del chofer) - UI compartida: popup con un mapa Leaflet
// mostrando TODAS las paradas de la ruta de una vez, ya cargadas en orden,
// en vez de ir viéndolas de a una (pedido de Matías, Fase 6 punto 39:
// "que el chofer pueda abrir la ruta completa en el mapa, que ya tenga
// cargados todos los contenedores por los que tiene que pasar, todas las
// paradas"). Mismo patrón de overlay dinámico que confirmar-ui.js /
// asignar-ui.js, pero el contenido es un mapa en vez de texto.
//
// Usa Leaflet + OpenStreetMap sin API key, mismo enfoque que ya usa
// landing/js/mapa.js -- se vendoriza una copia propia en backoffice/vendor/
// porque landing/ y backoffice/ son apps separadas (paths relativos propios,
// no comparten build).
//
// No hace ruteo real por calles -- las paradas vienen del mismo orden
// aproximado por cercanía en línea recta que ya arma el admin al crear la
// ruta (ver panel-chofer.js y js/admin/controller.js, ordenParaPersistir).
// Esto solo las pinta todas juntas en un mapa para que el chofer tenga una
// vista de conjunto, no reemplaza abrir una parada puntual en Google Maps.

function escapeHtmlMapaRuta(valor) {
    return String(valor ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

function tieneCoordenadas(contenedor) {
    return contenedor.latitudContenedor !== null && contenedor.latitudContenedor !== undefined && contenedor.latitudContenedor !== ""
        && contenedor.longitudContenedor !== null && contenedor.longitudContenedor !== undefined && contenedor.longitudContenedor !== "";
}

let overlay;
let mapaDiv;
let mapa; // instancia de Leaflet; se destruye y se recrea en cada apertura (ver cerrar()).

function alTeclado(evento) {
    if (evento.key === "Escape") cerrar();
}

function cerrar() {
    if (!overlay || overlay.classList.contains("oculto")) return;

    overlay.classList.add("oculto");
    document.removeEventListener("keydown", alTeclado);

    // Leaflet no banca bien que su contenedor vuelva a 0×0 (el modal se
    // oculta) y después a su tamaño real sin avisarle -- más simple destruir
    // la instancia entera acá y recrearla de cero la próxima vez que se
    // abra, que manejar invalidateSize() + el resize del modal.
    if (mapa) {
        mapa.remove();
        mapa = null;
    }
}

function asegurarModal() {
    if (overlay) return;

    overlay = document.createElement("div");
    overlay.className = "modal-overlay oculto";
    overlay.innerHTML = `
        <div class="modal-card modal-mapa-ruta">
            <div class="modal-header">
                <h3>Mi ruta en el mapa</h3>
                <button type="button" class="modal-cerrar" data-accion="cerrar" aria-label="Cerrar">✕</button>
            </div>
            <div class="mapa-ruta-contenedor"></div>
        </div>
    `;
    document.body.appendChild(overlay);

    mapaDiv = overlay.querySelector(".mapa-ruta-contenedor");
    overlay.querySelector('[data-accion="cerrar"]').addEventListener("click", cerrar);
    overlay.addEventListener("click", (evento) => {
        if (evento.target === overlay) cerrar();
    });
}

// `paradas` = [{ contenedor, numero }], mismo shape que arma panel-chofer.js
// (numero = orden fijo de la ruta, no se recalcula al ir marcando).
// `recolectados` = Set<string> de idContenedor ya levantados hoy (ver
// obtenerRecolectados() en panel-chofer.js).
export function mostrarMapaRuta(paradas, recolectados) {
    asegurarModal();

    overlay.classList.remove("oculto");
    document.addEventListener("keydown", alTeclado);

    // El modal recién pasa a visible acá -- si Leaflet se inicializa con el
    // div todavía oculto (display:none del frame anterior) mide 0×0 y el
    // mapa queda roto. Se espera un frame a que el navegador ya haya
    // pintado el modal antes de crear el mapa.
    requestAnimationFrame(() => {
        const conCoordenadas = paradas.filter(({ contenedor }) => tieneCoordenadas(contenedor));

        if (!conCoordenadas.length) {
            mapaDiv.innerHTML = `<p class="detail-empty">Ninguno de los contenedores de tu ruta tiene coordenadas cargadas todavía.</p>`;
            return;
        }

        mapaDiv.innerHTML = "";
        mapa = L.map(mapaDiv);

        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: "&copy; colaboradores de OpenStreetMap",
            maxZoom: 19
        }).addTo(mapa);

        const puntos = conCoordenadas.map(({ contenedor, numero }) => {
            const lat = Number(contenedor.latitudContenedor);
            const lng = Number(contenedor.longitudContenedor);
            const hecha = recolectados.has(String(contenedor.idContenedor));

            const icono = L.divIcon({
                className: `mapa-ruta-marcador${hecha ? " mapa-ruta-marcador--hecha" : ""}`,
                html: `<span>${numero}</span>`,
                iconSize: [30, 30],
                iconAnchor: [15, 15]
            });

            L.marker([lat, lng], { icon: icono }).addTo(mapa).bindPopup(`
                <strong>${numero}. Contenedor #${escapeHtmlMapaRuta(contenedor.idContenedor)}</strong><br>
                ${escapeHtmlMapaRuta(contenedor.ubicacionContenedor || "Sin dirección")}
                ${hecha ? "<br>✅ Ya levantado" : ""}
            `);

            return [lat, lng];
        });

        // Línea punteada que une las paradas en el orden de la ruta -- solo
        // de referencia visual, no es un ruteo real por calles (ver nota
        // arriba de este archivo).
        L.polyline(puntos, { color: "#082b4f", weight: 3, opacity: 0.6, dashArray: "6 8" }).addTo(mapa);

        mapa.fitBounds(puntos, { padding: [30, 30] });
    });
}
