// Mapa interactivo de la entrega final (Leaflet + OpenStreetMap, sin API
// key): contenedores con sus coordenadas e incidencias abiertas, usando
// los mismos endpoints públicos que ya consume el buscador de incidencias
// (sin sesión, GET de contenedor/incidencia).
//
// Con los ~11.130 contenedores oficiales de la IMM cargados (05/10/2026),
// ya no se puede traer obtenerTodos() entero para pintarlo de una: el mapa
// pide solo los contenedores dentro de su viewport actual (bounding box) y
// los agrupa con Leaflet.markercluster para no pintar miles de markers
// sueltos. Ambos (el bounding box del backend y el clustering acá) son
// necesarios -- uno reduce lo que se pide, el otro reduce lo que se pinta.

const API_GESTION_MAPA = "../../api-gestion/index.php";

// Centro aproximado de Montevideo, para cuando todavía no hay ningún
// contenedor con coordenadas cargadas.
const CENTRO_MAPA_MVD = [-34.9011, -56.1645];

// Espera tras el último moveend/zoomend antes de pedir de nuevo los
// contenedores visibles -- evita un fetch por cada frame mientras se
// arrastra o se hace zoom con la rueda.
const ESPERA_RECARGA_MS = 300;

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

function debounce(funcion, esperaMs) {
    let temporizador = null;
    return (...args) => {
        clearTimeout(temporizador);
        temporizador = setTimeout(() => funcion(...args), esperaMs);
    };
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

async function obtenerContenedorPorId(idContenedor) {
    try {
        const parametros = new URLSearchParams({ recurso: "contenedor", id: idContenedor });
        const respuesta = await fetch(`${API_GESTION_MAPA}?${parametros.toString()}`, {
            credentials: "same-origin"
        });
        const datos = await respuesta.json().catch(() => null);
        return respuesta.ok && datos && typeof datos === "object" ? datos : null;
    } catch (error) {
        return null;
    }
}

// Solo los contenedores dentro del rectángulo visible del mapa (ver
// ContenedorController::obtenerEnBoundingBox en api-gestion).
async function obtenerContenedoresEnBbox(limites) {
    try {
        const parametros = new URLSearchParams({
            recurso: "contenedor",
            bboxNorte: limites.getNorth(),
            bboxSur: limites.getSouth(),
            bboxEste: limites.getEast(),
            bboxOeste: limites.getWest()
        });
        const respuesta = await fetch(`${API_GESTION_MAPA}?${parametros.toString()}`, {
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

function crearMarcadorContenedor(fila) {
    const lat = Number(fila.latitudContenedor);
    const lng = Number(fila.longitudContenedor);
    if (!coordenadasValidas(lat, lng)) return null;

    return L.marker([lat, lng]).bindPopup(`
        <strong>Contenedor #${escapeHtmlMapa(fila.idContenedor)}</strong><br>
        ${escapeHtmlMapa(fila.ubicacionContenedor || "Sin dirección")}<br>
        Estado: ${escapeHtmlMapa(fila.estadoContenedor || "")}<br>
        Tipo de residuo: ${escapeHtmlMapa(fila.tipoResiduoContenedor || "")}
    `);
}

// Las incidencias no tienen coordenadas propias: se ubican en el punto del
// contenedor al que pertenecen (idContenedor), con un pequeño
// desplazamiento para que no quede tapada por el marcador del contenedor.
// Se resuelven aparte (obtenerContenedorPorId), sin depender de que ese
// contenedor esté dentro del viewport actual: una incidencia abierta tiene
// que verse en el mapa aunque el usuario todavía no haya navegado hasta ahí.
function pintarIncidenciaEnMapa(mapa, incidencia, contenedor) {
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

async function cargarIncidenciasEnMapa(mapa) {
    const incidencias = await obtenerRecursoGestion("incidencia");

    const incidenciasAbiertas = incidencias.filter(
        (incidencia) => incidencia.estadoIncidencia !== "resuelta" && incidencia.idContenedor != null
    );

    // Varias incidencias pueden compartir contenedor: se pide cada
    // contenedor una sola vez, no una vez por incidencia.
    const idsContenedorUnicos = [...new Set(incidenciasAbiertas.map((i) => String(i.idContenedor)))];
    const contenedoresEncontrados = await Promise.all(idsContenedorUnicos.map(obtenerContenedorPorId));

    const contenedoresPorId = new Map();
    idsContenedorUnicos.forEach((id, indice) => {
        if (contenedoresEncontrados[indice]) contenedoresPorId.set(id, contenedoresEncontrados[indice]);
    });

    incidenciasAbiertas.forEach((incidencia) => {
        const contenedor = contenedoresPorId.get(String(incidencia.idContenedor));
        if (contenedor) pintarIncidenciaEnMapa(mapa, incidencia, contenedor);
    });
}

async function recargarContenedoresVisibles(mapa, capaCluster) {
    const contenedores = await obtenerContenedoresEnBbox(mapa.getBounds());

    capaCluster.clearLayers();
    contenedores.forEach((fila) => {
        const marcador = crearMarcadorContenedor(fila);
        if (marcador) capaCluster.addLayer(marcador);
    });
}

// ---------------------------------------------------------------------------
// Buscador del mapa: municipio y barrio (listas desplegables) + calle y
// número de puerta (texto libre). Los tres filtros son independientes y
// combinables entre sí -- se puede buscar solo por calle, sin elegir barrio
// ni municipio (ver ContenedorController::buscar en api-gestion, que ya
// resuelve "calle y numero" con un solo LIKE sobre ubicacionContenedor).
// ---------------------------------------------------------------------------

// Mientras hay una búsqueda activa, el recargo automático por bounding box
// (moveend/zoomend) se pausa: si no, el propio fitBounds() que usa el
// buscador para centrar los resultados dispararía un moveend que los pisa
// con lo que entra en ese viewport.
let modoBusquedaMapaActivo = false;

async function obtenerFiltrosDisponiblesMapa() {
    try {
        const parametros = new URLSearchParams({ recurso: "contenedor", accion: "filtros" });
        const respuesta = await fetch(`${API_GESTION_MAPA}?${parametros.toString()}`, {
            credentials: "same-origin"
        });
        const datos = await respuesta.json().catch(() => null);
        if (!respuesta.ok || !datos || typeof datos !== "object") return { barrios: [], municipios: [] };
        return {
            barrios: Array.isArray(datos.barrios) ? datos.barrios : [],
            municipios: Array.isArray(datos.municipios) ? datos.municipios : []
        };
    } catch (error) {
        return { barrios: [], municipios: [] };
    }
}

async function buscarContenedoresMapa({ direccion, barrio, municipio }) {
    try {
        const parametros = new URLSearchParams({ recurso: "contenedor" });
        if (direccion) parametros.set("direccion", direccion);
        if (barrio) parametros.set("barrio", barrio);
        if (municipio) parametros.set("municipio", municipio);

        const respuesta = await fetch(`${API_GESTION_MAPA}?${parametros.toString()}`, {
            credentials: "same-origin"
        });
        const datos = await respuesta.json().catch(() => null);
        return respuesta.ok && Array.isArray(datos) ? datos : [];
    } catch (error) {
        return [];
    }
}

// Usa textContent (no innerHTML) para los <option>: no hace falta escapar a
// mano, el navegador nunca interpreta ese texto como HTML.
function poblarSelectMapa(elementoSelect, valores) {
    if (!elementoSelect) return;
    valores.forEach((valor) => {
        const opcion = document.createElement("option");
        opcion.value = valor;
        opcion.textContent = valor;
        elementoSelect.appendChild(opcion);
    });
}

function mostrarEstadoBuscadorMapa(elementoEstado, mensaje, esVacio) {
    if (!elementoEstado) return;
    elementoEstado.textContent = mensaje;
    elementoEstado.classList.toggle("map-buscador-estado-vacio", Boolean(esVacio));
}

async function inicializarBuscadorMapa(mapa, capaCluster) {
    const formulario = document.getElementById("buscadorMapa");
    const selectMunicipio = document.getElementById("buscadorMapaMunicipio");
    const selectBarrio = document.getElementById("buscadorMapaBarrio");
    const campoCalle = document.getElementById("buscadorMapaCalle");
    const elementoEstado = document.getElementById("buscadorMapaEstado");
    const botonLimpiar = document.getElementById("buscadorMapaLimpiar");

    if (!formulario) return;

    const filtros = await obtenerFiltrosDisponiblesMapa();
    poblarSelectMapa(selectMunicipio, filtros.municipios);
    poblarSelectMapa(selectBarrio, filtros.barrios);

    formulario.addEventListener("submit", async (evento) => {
        evento.preventDefault();

        const direccion = campoCalle ? campoCalle.value.trim() : "";
        const barrio = selectBarrio ? selectBarrio.value : "";
        const municipio = selectMunicipio ? selectMunicipio.value : "";

        if (!direccion && !barrio && !municipio) {
            mostrarEstadoBuscadorMapa(elementoEstado, "Ingresá al menos un criterio: municipio, barrio o calle.", true);
            return;
        }

        mostrarEstadoBuscadorMapa(elementoEstado, "Buscando...", false);

        const resultados = await buscarContenedoresMapa({ direccion, barrio, municipio });

        // A partir de aquí el recargo por viewport queda pausado hasta que
        // se limpie la búsqueda (ver recargarDebounced en cargarMapaIncidencias).
        modoBusquedaMapaActivo = true;
        capaCluster.clearLayers();

        const marcadores = resultados.map((fila) => crearMarcadorContenedor(fila)).filter(Boolean);
        marcadores.forEach((marcador) => capaCluster.addLayer(marcador));

        if (marcadores.length === 0) {
            mostrarEstadoBuscadorMapa(elementoEstado, "No se encontraron contenedores con esos criterios.", true);
            return;
        }

        mostrarEstadoBuscadorMapa(
            elementoEstado,
            marcadores.length === 1 ? "Se encontró 1 contenedor." : `Se encontraron ${marcadores.length} contenedores.`,
            false
        );

        const grupoResultados = L.featureGroup(marcadores);
        mapa.fitBounds(grupoResultados.getBounds(), { padding: [40, 40], maxZoom: 18 });

        if (marcadores.length === 1) marcadores[0].openPopup();
    });

    if (botonLimpiar) {
        botonLimpiar.addEventListener("click", () => {
            formulario.reset();
            mostrarEstadoBuscadorMapa(elementoEstado, "", false);
            modoBusquedaMapaActivo = false;
            recargarContenedoresVisibles(mapa, capaCluster);
        });
    }
}

async function cargarMapaIncidencias() {
    const elementoMapa = document.getElementById("mapaIncidencias");
    if (!elementoMapa || typeof L === "undefined") return;

    const mapa = L.map(elementoMapa).setView(CENTRO_MAPA_MVD, 13);

    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
        maxZoom: 19
    }).addTo(mapa);

    // Agrupa los contenedores cercanos en un círculo con un número (se abre
    // solo al hacer zoom) -- sin esto, los miles de contenedores oficiales
    // de la IMM harían casi imposible leer el mapa o navegar por él.
    const capaClusterContenedores = L.markerClusterGroup({ chunkedLoading: true });
    mapa.addLayer(capaClusterContenedores);

    const recargarDebounced = debounce(
        () => recargarContenedoresVisibles(mapa, capaClusterContenedores),
        ESPERA_RECARGA_MS
    );
    mapa.on("moveend", recargarDebounced);
    mapa.on("zoomend", recargarDebounced);

    await Promise.all([
        recargarContenedoresVisibles(mapa, capaClusterContenedores),
        cargarIncidenciasEnMapa(mapa)
    ]);
}

document.addEventListener("DOMContentLoaded", cargarMapaIncidencias);
