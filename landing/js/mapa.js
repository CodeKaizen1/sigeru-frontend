// Mapa interactivo de la entrega final (Leaflet + OpenStreetMap, sin API
// key): contenedores con sus coordenadas e incidencias abiertas, usando
// los mismos endpoints públicos que ya consume el buscador de incidencias
// (sin sesión, GET de contenedor/incidencia).

const API_GESTION_MAPA = "../../api-gestion/index.php";

// Centro aproximado de Montevideo, para cuando todavía no hay ningún
// contenedor con coordenadas cargadas.
const CENTRO_MAPA_MVD = [-34.9011, -56.1645];

// Mismo patrón que escapeHtml() en buscador-incidencias.js / view.js: los
// popups de Leaflet insertan este HTML con innerHTML, así que lo que venga
// del servidor hay que escaparlo igual que en cualquier otro lado de la
// página.
function escapeHtmlMapa(valor) {
    return String(valor ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

async function obtenerRecursoGestion(recurso) {
    try {
        const respuesta = await fetch(`${API_GESTION_MAPA}?recurso=${recurso}`, {
            credentials: "same-origin"
        });
        const datos = await respuesta.json().catch(() => null);
        return respuesta.ok && Array.isArray(datos) ? datos : [];
    } catch (error) {
        return [];
    }
}

function coordenadasValidas(lat, lng) {
    return Number.isFinite(lat) && Number.isFinite(lng);
}

function pintarContenedorEnMapa(mapa, fila) {
    const lat = Number(fila.latitudContenedor);
    const lng = Number(fila.longitudContenedor);
    if (!coordenadasValidas(lat, lng)) return;

    L.marker([lat, lng]).addTo(mapa).bindPopup(`
        <strong>Contenedor #${escapeHtmlMapa(fila.idContenedor)}</strong><br>
        ${escapeHtmlMapa(fila.ubicacionContenedor || "Sin dirección")}<br>
        Estado: ${escapeHtmlMapa(fila.estadoContenedor || "")}<br>
        Tipo de residuo: ${escapeHtmlMapa(fila.tipoResiduoContenedor || "")}
    `);
}

// Las incidencias no tienen coordenadas propias: se ubican en el punto del
// contenedor al que pertenecen (idContenedor), con un pequeño
// desplazamiento para que no quede tapada por el marcador del contenedor.
function pintarIncidenciaEnMapa(mapa, incidencia, contenedoresPorId) {
    if (incidencia.idContenedor == null) return;

    const contenedor = contenedoresPorId.get(String(incidencia.idContenedor));
    if (!contenedor) return;

    const lat = Number(contenedor.latitudContenedor);
    const lng = Number(contenedor.longitudContenedor);
    if (!coordenadasValidas(lat, lng)) return;

    L.circleMarker([lat + 0.0003, lng + 0.0003], {
        radius: 9,
        color: "#b3261e",
        weight: 2,
        fillColor: "#e2574c",
        fillOpacity: 0.9
    }).addTo(mapa).bindPopup(`
        <strong>Incidencia #${escapeHtmlMapa(incidencia.idIncidencia)}</strong><br>
        ${escapeHtmlMapa(incidencia.tipoIncidencia || "Otra situación")}<br>
        Zona: ${escapeHtmlMapa(incidencia.zonaIncidencia || "")}<br>
        Estado: ${escapeHtmlMapa(incidencia.estadoIncidencia || "")}
    `);
}

async function cargarMapaIncidencias() {
    const elementoMapa = document.getElementById("mapaIncidencias");
    if (!elementoMapa || typeof L === "undefined") return;

    const mapa = L.map(elementoMapa).setView(CENTRO_MAPA_MVD, 13);

    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
        maxZoom: 19
    }).addTo(mapa);

    const [contenedores, incidencias] = await Promise.all([
        obtenerRecursoGestion("contenedor"),
        obtenerRecursoGestion("incidencia")
    ]);

    const contenedoresPorId = new Map(contenedores.map((fila) => [String(fila.idContenedor), fila]));

    contenedores.forEach((fila) => pintarContenedorEnMapa(mapa, fila));

    incidencias
        .filter((incidencia) => incidencia.estadoIncidencia !== "resuelta")
        .forEach((incidencia) => pintarIncidenciaEnMapa(mapa, incidencia, contenedoresPorId));
}

document.addEventListener("DOMContentLoaded", cargarMapaIncidencias);
