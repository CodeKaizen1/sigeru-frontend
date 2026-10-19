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
// El ORDEN de las paradas (el número de cada marcador) es el que ya viene
// persistido en ordenRutaContenedor -- este archivo nunca lo recalcula ni
// lo cambia, solo lo pinta (ver js/admin/controller.js, ordenParaPersistir,
// que desde el 15/10 usa OSRM para calcular ese orden al crear la ruta).
//
// 15/10/2026, 2da vuelta (pedido de Matías: "actualizar lo de ver ruta
// porque está bueno para visualizar cómo es la ruta"): la línea que une las
// paradas SÍ se actualizó para seguir las calles de verdad -- se le pide a
// OSRM (mismo servicio gratuito sin API key que ya usa controller.js para
// el orden, ver OSRM_ROUTE_URL más abajo) la geometría real del camino
// entre las paradas, EN EL ORDEN YA DADO (servicio /route, no /trip -- acá
// no se reordena nada, solo se dibuja el trayecto real entre los puntos tal
// como están). Si OSRM no responde (caído, timeout, sin red), se cae a la
// línea punteada recta de antes -- nunca se deja de mostrar la ruta por un
// servicio externo gratuito caído.

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

const OSRM_ROUTE_URL = "https://router.project-osrm.org/route/v1/driving";
const OSRM_ROUTE_TIMEOUT_MS = 6000;

// Geometría real del camino entre `puntos` ([lat,lng], YA en el orden de la
// ruta) -- null si OSRM no está disponible, tarda más de la cuenta, o
// devuelve algo inesperado (ver nota arriba del archivo: nunca bloquea
// mostrar el mapa, solo hace que se use el respaldo de línea recta).
async function geometriaRealDelCamino(puntos) {
    if (puntos.length < 2) return null;

    const coordenadas = puntos.map(([lat, lng]) => `${lng},${lat}`).join(";");
    const controlador = new AbortController();
    const temporizador = setTimeout(() => controlador.abort(), OSRM_ROUTE_TIMEOUT_MS);

    try {
        const parametros = new URLSearchParams({ overview: "full", geometries: "geojson" });
        const respuesta = await fetch(`${OSRM_ROUTE_URL}/${coordenadas}?${parametros.toString()}`, {
            signal: controlador.signal
        });
        const datos = await respuesta.json().catch(() => null);

        if (!respuesta.ok || !datos || datos.code !== "Ok" || !Array.isArray(datos.routes) || !datos.routes[0]) return null;

        const geometria = datos.routes[0].geometry;
        if (!geometria || geometria.type !== "LineString" || !Array.isArray(geometria.coordinates)) return null;

        // GeoJSON viene como [lon,lat] -- Leaflet quiere [lat,lon].
        return geometria.coordinates.map(([lon, lat]) => [lat, lon]);
    } catch (error) {
        return null;
    } finally {
        clearTimeout(temporizador);
    }
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
                <button type="button" class="modal-cerrar" data-accion="cerrar" aria-label="Cerrar"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="M6 6l12 12"/></svg></button>
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
    requestAnimationFrame(async () => {
        const conCoordenadas = paradas.filter(({ contenedor }) => tieneCoordenadas(contenedor));

        if (!conCoordenadas.length) {
            mapaDiv.innerHTML = `<p class="detail-empty">Ninguno de los contenedores de tu ruta tiene coordenadas cargadas todavía.</p>`;
            return;
        }

        mapaDiv.innerHTML = "";
        mapa = L.map(mapaDiv);
        const mapaDeEstaApertura = mapa; // ver guarda más abajo, tras el await a OSRM.

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

        // Mientras se espera a OSRM, se muestra enseguida la línea recta de
        // siempre -- así el mapa no queda en blanco esperando la red, y si
        // OSRM falla esto mismo queda como resultado final (ver nota arriba
        // del archivo).
        const lineaRecta = L.polyline(puntos, { color: "#082b4f", weight: 3, opacity: 0.6, dashArray: "6 8" }).addTo(mapa);
        mapa.fitBounds(puntos, { padding: [30, 30] });

        const caminoReal = await geometriaRealDelCamino(puntos);

        // Si mientras se esperaba la respuesta el chofer cerró el modal (o
        // lo volvió a abrir, creando OTRA instancia de mapa), esta respuesta
        // ya quedó vieja -- no hay que dibujar nada sobre un mapa destruido
        // o que ya no es el que el chofer está mirando.
        if (!caminoReal || mapa !== mapaDeEstaApertura) return;

        lineaRecta.remove();
        L.polyline(caminoReal, { color: "#1a73c7", weight: 5, opacity: 0.85 }).addTo(mapa);
        mapa.fitBounds(caminoReal, { padding: [30, 30] });
    });
}
