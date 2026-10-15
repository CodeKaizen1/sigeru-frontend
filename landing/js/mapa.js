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

// ---------------------------------------------------------------------------
// Geocodificación de esquinas sin contenedor (Fase 6 punto 40, pedido de
// Matías 15/10/2026): "que en el mapa de la landing se pueda buscar ej. Mac
// Eachen y Bado y el mapa me muestre esa esquina aunque no haya un
// contenedor, y pueda ver los contenedores más próximos a esa esquina".
// buscarContenedoresMapa() (más abajo) solo encuentra contenedores YA
// registrados, y de forma bastante laxa: ContenedorController::buscar separa
// "calle y esquina" en sus 2 partes y hace un OR de LIKE entre ellas, así que
// "Mac Eachen y Bado" matchea cualquier contenedor de la calle Mac Eachen
// aunque esté a varias cuadras de Bado -- no sirve para ubicar la esquina
// puntual que se escribió. Por eso la geocodificación con Nominatim (el de
// OpenStreetMap, gratuito y sin API key, mismo proveedor que ya da las tiles
// del mapa) se intenta SIEMPRE que se escribió algo en "calle y esquina" (no
// solo cuando buscarContenedoresMapa no encontró nada -- ver el submit del
// formulario, 15/10/2026 2da vuelta: con el "solo si 0 resultados" de antes,
// "Mac Eachen y Bado" nunca llegaba a geocodificarse porque el OR de arriba
// sí encontraba contenedores, pero ninguno era la esquina buscada).
//
// 3ra vuelta (15/10/2026, probado contra el Nominatim real): pedirle a
// Nominatim el texto completo "Mac Eachen y Bado" (o cualquier "calle1 y
// calle2") devuelve SIEMPRE una lista vacía -- su buscador de texto libre no
// entiende intersecciones, y la sintaxis estructurada de otros geocodificadores
// para cruces ("calle1 & calle2") tampoco funciona con los datos de
// Montevideo (se probó en vivo, ver consola). Nominatim SÍ geocodifica bien
// cada calle por separado ("Eduardo Mac Eachen" y "Bado" devuelven resultados
// reales). Entonces: se separa el texto en sus 2 partes con los mismos
// separadores que ya usa el backend (separarCalleYEsquina), se geocodifica
// cada una por separado (puede haber varios tramos con el mismo nombre en
// distintos barrios) y se toma el PAR de tramos más cercano entre ambas
// listas como aproximación de dónde se cruzan (el punto medio entre los 2).
// No es un cálculo exacto de intersección de calles, pero alcanza para
// ubicar la zona -- mismo criterio de "aproximado, no es ruteo real" que ya
// se usa en el resto del mapa.
//
// Nunca se geocodifica por tecla, sólo al enviar el formulario, y entre las
// 2 solicitudes (una por calle) se espera un poco más de 1 segundo, para no
// pasarse del límite de uso de Nominatim (máx. 1 solicitud/segundo, nada de
// uso automatizado pesado -- ver
// https://operations.osmfoundation.org/policies/nominatim/).
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const ESPERA_ENTRE_PEDIDOS_NOMINATIM_MS = 1100;

// Mismos separadores que ContenedorController::separarCalleYEsquina en el
// backend (api-gestion) -- se prueban en este orden y se corta en el primero
// que aparezca.
const SEPARADORES_ESQUINA = [" esquina ", " esq. ", " esq ", " y ", " con ", "/"];

function separarCalleYEsquina(texto) {
    const conEspacios = ` ${texto} `;
    const enMinusculas = conEspacios.toLowerCase();

    for (const separador of SEPARADORES_ESQUINA) {
        const indice = enMinusculas.indexOf(separador);
        if (indice === -1) continue;

        const parte1 = conEspacios.slice(0, indice).trim();
        const parte2 = conEspacios.slice(indice + separador.length).trim();
        if (parte1 && parte2) return [parte1, parte2];
    }

    return [texto.trim()];
}

// Distancia euclídea simple en grados -- solo para COMPARAR qué tan cerca
// está un candidato de otro (elegir el par más cercano), no para medir
// metros reales -- alcanza para eso a esta escala (una ciudad).
function distanciaEntrePuntos(a, b) {
    const dLat = a.lat - b.lat;
    const dLng = a.lng - b.lng;
    return Math.sqrt(dLat * dLat + dLng * dLng);
}

async function buscarEnNominatim(texto, limite, caja) {
    try {
        const parametros = new URLSearchParams({
            q: `${texto}, Montevideo, Uruguay`,
            format: "json",
            limit: String(limite),
            countrycodes: "uy"
        });

        // `caja` (opcional): [minLon, maxLat, maxLon, minLat] -- acota la
        // búsqueda a ese rectángulo (ver geocodificarDireccion más abajo,
        // 4ta vuelta: sin esto, una avenida larga como "Rivera" devuelve
        // tramos repartidos por toda la ciudad y ninguno es necesariamente
        // el que cruza la otra calle buscada).
        if (caja) {
            parametros.set("viewbox", caja.join(","));
            parametros.set("bounded", "1");
        }

        const respuesta = await fetch(`${NOMINATIM_URL}?${parametros.toString()}`);
        const datos = await respuesta.json().catch(() => null);
        if (!respuesta.ok || !Array.isArray(datos)) return [];

        return datos
            .map((fila) => ({ lat: Number(fila.lat), lng: Number(fila.lon) }))
            .filter((punto) => coordenadasValidas(punto.lat, punto.lng));
    } catch (error) {
        return [];
    }
}

function esperar(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// Rectángulo [minLon, maxLat, maxLon, minLat] de +/- `radioGrados` alrededor
// de un punto, en el formato que espera el parámetro `viewbox` de Nominatim.
function cajaAlrededorDe(punto, radioGrados) {
    return [punto.lng - radioGrados, punto.lat + radioGrados, punto.lng + radioGrados, punto.lat - radioGrados];
}

function masCercanoA(ancla, candidatos) {
    let mejor = candidatos[0];
    let mejorDistancia = distanciaEntrePuntos(ancla, mejor);

    for (const candidato of candidatos.slice(1)) {
        const distancia = distanciaEntrePuntos(ancla, candidato);
        if (distancia < mejorDistancia) {
            mejorDistancia = distancia;
            mejor = candidato;
        }
    }

    return mejor;
}

// Radio de la caja de búsqueda acotada, en grados (~1.1 km) -- si no
// aparece nada ahí adentro se prueba una vez más con el doble.
const RADIO_CAJA_ESQUINA_GRADOS = 0.01;

async function geocodificarDireccion(texto) {
    const partes = separarCalleYEsquina(texto);

    if (partes.length === 1) {
        const candidatos = await buscarEnNominatim(partes[0], 1);
        return candidatos[0] || null;
    }

    // "Calle1 y calle2": geocodificar cada calle por separado SIN acotar y
    // quedarse con el par de candidatos más cercano entre las 2 listas
    // suena razonable, pero falla con calles largas -- Nominatim solo
    // devuelve un puñado de tramos "representativos" de una avenida larga
    // (uno por barrio que atraviesa), y el tramo que realmente cruza la
    // otra calle buscada puede no estar entre esos pocos (bug reportado
    // por Matías con "Rivera y Rocafuerte": el tramo de Avenida Rivera más
    // cercano que devolvía Nominatim en ese muestreo quedaba a más de 1 km
    // de la esquina real con Rocafuerte, en el barrio equivocado).
    //
    // El arreglo (4ta vuelta, 15/10/2026): geocodificar primero la calle
    // con MENOS resultados sin acotar (normalmente la más corta/específica
    // de las 2 -- "Rocafuerte" da 1 solo tramo contra los 10 de "Rivera") y
    // usar su mejor resultado como ancla. La OTRA calle se vuelve a buscar
    // acotada (viewbox + bounded=1) a una caja de ~1 km alrededor de esa
    // ancla, así Nominatim solo puede devolver el tramo que de verdad está
    // cerca, no cualquier tramo del país con ese nombre.
    const candidatos1 = await buscarEnNominatim(partes[0], 10);
    await esperar(ESPERA_ENTRE_PEDIDOS_NOMINATIM_MS);
    const candidatos2 = await buscarEnNominatim(partes[1], 10);

    if (!candidatos1.length && !candidatos2.length) return null;
    if (!candidatos1.length) return candidatos2[0];
    if (!candidatos2.length) return candidatos1[0];

    const calle1EsAncla = candidatos1.length <= candidatos2.length;
    const ancla = calle1EsAncla ? candidatos1[0] : candidatos2[0];
    const otraCalle = calle1EsAncla ? partes[1] : partes[0];

    await esperar(ESPERA_ENTRE_PEDIDOS_NOMINATIM_MS);
    let cercanos = await buscarEnNominatim(otraCalle, 5, cajaAlrededorDe(ancla, RADIO_CAJA_ESQUINA_GRADOS));

    if (!cercanos.length) {
        await esperar(ESPERA_ENTRE_PEDIDOS_NOMINATIM_MS);
        cercanos = await buscarEnNominatim(otraCalle, 5, cajaAlrededorDe(ancla, RADIO_CAJA_ESQUINA_GRADOS * 2));
    }

    if (!cercanos.length) {
        // Ninguna variante de la otra calle apareció cerca del ancla (puede
        // que las 2 calles no se crucen en realidad, o que falte ese tramo
        // en OpenStreetMap) -- se cae al criterio anterior (el par más
        // cercano de las listas SIN acotar) como mejor esfuerzo, en vez de
        // no mostrar nada.
        let mejorPar = null;
        let mejorDistancia = Infinity;

        for (const puntoA of candidatos1) {
            for (const puntoB of candidatos2) {
                const distancia = distanciaEntrePuntos(puntoA, puntoB);
                if (distancia < mejorDistancia) {
                    mejorDistancia = distancia;
                    mejorPar = [puntoA, puntoB];
                }
            }
        }

        const [puntoA, puntoB] = mejorPar;
        return { lat: (puntoA.lat + puntoB.lat) / 2, lng: (puntoA.lng + puntoB.lng) / 2 };
    }

    const masCercano = masCercanoA(ancla, cercanos);
    return { lat: (ancla.lat + masCercano.lat) / 2, lng: (ancla.lng + masCercano.lng) / 2 };
}

// Marcador de la esquina buscada -- aparte de capaCluster (no es un
// contenedor, no se agrupa con ellos) para que se note que es un resultado
// distinto. Uno solo a la vez: una búsqueda nueva saca el anterior.
let marcadorBusquedaEsquina = null;

function ocultarMarcadorEsquina(mapa) {
    if (!marcadorBusquedaEsquina) return;
    mapa.removeLayer(marcadorBusquedaEsquina);
    marcadorBusquedaEsquina = null;
}

// Pin rojo clásico (gota + centro blanco), no el emoji de antes -- a pedido
// de Matías ("marcar el punto que se busca con un ícono rojo como suele ser
// en los mapas"), 15/10/2026 2da vuelta.
const SVG_PIN_ESQUINA = `
    <svg width="30" height="42" viewBox="0 0 30 42" xmlns="http://www.w3.org/2000/svg">
        <path d="M15 0C6.7 0 0 6.7 0 15c0 11.25 15 27 15 27s15-15.75 15-27C30 6.7 23.3 0 15 0z" fill="#d32f2f" stroke="#7a1313" stroke-width="1.5"/>
        <circle cx="15" cy="15" r="6" fill="white"/>
    </svg>
`;

function mostrarMarcadorEsquina(mapa, lat, lng, etiqueta) {
    ocultarMarcadorEsquina(mapa);

    const icono = L.divIcon({
        className: "mapa-marcador-esquina",
        html: SVG_PIN_ESQUINA,
        iconSize: [30, 42],
        iconAnchor: [15, 42],
        popupAnchor: [0, -38]
    });

    marcadorBusquedaEsquina = L.marker([lat, lng], { icon: icono, zIndexOffset: 1000 })
        .addTo(mapa)
        .bindPopup(`<strong>${escapeHtmlMapa(etiqueta)}</strong><br>Esquina buscada -- no hay un contenedor registrado exactamente acá.`)
        .openPopup();
}

// Extraído de crearMarcadorContenedor() para reusarlo también en el popup
// que abre irAContenedorEnMapa() al elegir una coincidencia del autocompletar
// (no siempre hay todavía un marker de cluster en ese punto -- ver más abajo).
function contenidoPopupContenedor(fila) {
    return `
        <strong>Contenedor #${escapeHtmlMapa(fila.idContenedor)}</strong><br>
        ${escapeHtmlMapa(fila.ubicacionContenedor || "Sin dirección")}<br>
        Estado: ${escapeHtmlMapa(fila.estadoContenedor || "")}<br>
        Tipo de residuo: ${escapeHtmlMapa(fila.tipoResiduoContenedor || "")}
    `;
}

function crearMarcadorContenedor(fila) {
    const lat = Number(fila.latitudContenedor);
    const lng = Number(fila.longitudContenedor);
    if (!coordenadasValidas(lat, lng)) return null;

    return L.marker([lat, lng]).bindPopup(contenidoPopupContenedor(fila));
}

// Centra el mapa en un contenedor puntual y le abre el popup -- usado al
// elegir una coincidencia del autocompletar del buscador (ver
// inicializarBuscadorMapa). No depende de que ya exista un marker de
// cluster ahí: abre su propio popup standalone, y el recargo normal por
// bounding box (moveend) va a traer el marker real de todos modos una vez
// que el mapa termine de moverse a este punto.
function irAContenedorEnMapa(mapa, fila) {
    const lat = Number(fila.latitudContenedor);
    const lng = Number(fila.longitudContenedor);
    if (!coordenadasValidas(lat, lng)) return;

    mapa.setView([lat, lng], 18);
    L.popup().setLatLng([lat, lng]).setContent(contenidoPopupContenedor(fila)).openOn(mapa);
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
// esquina más cercana (texto libre). Los tres filtros son independientes y
// combinables entre sí -- se puede buscar solo por calle, sin elegir barrio
// ni municipio (ver ContenedorController::buscar en api-gestion, que ya
// resuelve cualquier texto libre con un solo LIKE sobre ubicacionContenedor,
// así que no importa si el usuario escribe un número de puerta, una esquina
// o solo el nombre de la calle).
// ---------------------------------------------------------------------------

// Mientras hay una búsqueda activa, el recargo automático por bounding box
// (moveend/zoomend) se pausa: si no, el propio fitBounds() que usa el
// buscador para centrar los resultados dispararía un moveend que los pisa
// con lo que entra en ese viewport.
let modoBusquedaMapaActivo = false;

// Autocompletar de "calle y esquina" -- mismo patrón que
// inicializarAutocompletarContenedor() en app.js (formulario de incidencias):
// a medida que el vecino escribe se piden coincidencias y se muestran en una
// lista; al elegir una, el mapa va directo a ESE contenedor puntual (en vez
// de tener que apretar "Buscar en el mapa" para ver todas las coincidencias
// a la vez). El botón de submit sigue andando igual que antes para una
// búsqueda amplia combinando calle + barrio + municipio.
const MAX_SUGERENCIAS_MAPA = 8;
const ESPERA_AUTOCOMPLETAR_MAPA_MS = 300;

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
    const listaResultadosCalle = document.getElementById("buscadorMapaCalleResultados");
    const elementoEstado = document.getElementById("buscadorMapaEstado");
    const botonLimpiar = document.getElementById("buscadorMapaLimpiar");

    if (!formulario) return;

    const filtros = await obtenerFiltrosDisponiblesMapa();
    poblarSelectMapa(selectMunicipio, filtros.municipios);
    poblarSelectMapa(selectBarrio, filtros.barrios);

    if (campoCalle && listaResultadosCalle) {
        let indiceActivo = -1;
        let coincidenciasVisibles = [];
        let tokenBusqueda = 0;

        function ocultarResultadosCalle() {
            listaResultadosCalle.hidden = true;
            listaResultadosCalle.innerHTML = "";
            indiceActivo = -1;
            coincidenciasVisibles = [];
        }

        function marcarActivoCalle(indice) {
            const items = listaResultadosCalle.querySelectorAll("li[role='option']");
            items.forEach((item) => item.classList.remove("autocomplete-activo"));
            if (indice >= 0 && items[indice]) {
                items[indice].classList.add("autocomplete-activo");
                items[indice].scrollIntoView({ block: "nearest" });
            }
            indiceActivo = indice;
        }

        function elegirContenedorMapa(contenedor) {
            ocultarResultadosCalle();
            ocultarMarcadorEsquina(mapa);
            campoCalle.value = contenedor.ubicacionContenedor;
            irAContenedorEnMapa(mapa, contenedor);
            mostrarEstadoBuscadorMapa(elementoEstado, `Mostrando: ${contenedor.ubicacionContenedor}`, false);
        }

        function pintarResultadosCalle(coincidencias) {
            coincidenciasVisibles = coincidencias.slice(0, MAX_SUGERENCIAS_MAPA);
            listaResultadosCalle.innerHTML = "";
            indiceActivo = -1;

            if (!coincidenciasVisibles.length) {
                const item = document.createElement("li");
                item.className = "autocomplete-sin-resultados";
                item.textContent = "No hay contenedores con esa dirección.";
                listaResultadosCalle.appendChild(item);
                listaResultadosCalle.hidden = false;
                return;
            }

            coincidenciasVisibles.forEach((contenedor) => {
                const item = document.createElement("li");
                item.setAttribute("role", "option");
                item.textContent = contenedor.zonaContenedor
                    ? `${contenedor.ubicacionContenedor} — ${contenedor.zonaContenedor}`
                    : contenedor.ubicacionContenedor;

                // mousedown (no click) para que dispare antes del blur del input.
                item.addEventListener("mousedown", (evento) => {
                    evento.preventDefault();
                    elegirContenedorMapa(contenedor);
                });

                listaResultadosCalle.appendChild(item);
            });

            listaResultadosCalle.hidden = false;
        }

        async function buscarYMostrarCalle() {
            const direccion = campoCalle.value.trim();
            const barrio = selectBarrio ? selectBarrio.value : "";
            const municipio = selectMunicipio ? selectMunicipio.value : "";

            if (!direccion) {
                ocultarResultadosCalle();
                return;
            }

            const miToken = ++tokenBusqueda;
            const coincidencias = await buscarContenedoresMapa({ direccion, barrio, municipio });

            // Si mientras esperaba la respuesta el vecino siguió escribiendo,
            // esta respuesta ya quedó vieja y se descarta.
            if (miToken !== tokenBusqueda) return;

            pintarResultadosCalle(coincidencias);
        }

        const buscarCalleDebounced = debounce(buscarYMostrarCalle, ESPERA_AUTOCOMPLETAR_MAPA_MS);

        campoCalle.addEventListener("input", buscarCalleDebounced);

        campoCalle.addEventListener("focus", () => {
            if (campoCalle.value.trim()) buscarCalleDebounced();
        });

        campoCalle.addEventListener("blur", () => {
            // Pequeña espera para que el mousedown de una opción llegue a
            // tiempo antes de que el blur cierre la lista.
            setTimeout(ocultarResultadosCalle, 150);
        });

        campoCalle.addEventListener("keydown", (evento) => {
            if (evento.key === "Escape") {
                ocultarResultadosCalle();
                return;
            }

            if (!coincidenciasVisibles.length) return;

            if (evento.key === "ArrowDown") {
                evento.preventDefault();
                marcarActivoCalle(Math.min(indiceActivo + 1, coincidenciasVisibles.length - 1));
            } else if (evento.key === "ArrowUp") {
                evento.preventDefault();
                marcarActivoCalle(Math.max(indiceActivo - 1, 0));
            } else if (evento.key === "Enter") {
                // coincidenciasVisibles ya viene vacío cuando pintarResultadosCalle()
                // solo mostró el mensaje de "sin resultados" (ver más arriba),
                // así que el guard de "!coincidenciasVisibles.length" de más
                // arriba ya cubre ese caso -- acá siempre hay una coincidencia
                // real para elegir. Mismo criterio que app.js: Enter elige en
                // vez de disparar el submit del formulario.
                evento.preventDefault();
                const indice = indiceActivo >= 0 ? indiceActivo : 0;
                elegirContenedorMapa(coincidenciasVisibles[indice]);
            }
        });
    }

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
        ocultarMarcadorEsquina(mapa);

        // Se pide a la vez el match de contenedores (por texto, lo de
        // siempre) y la geocodificación de lo escrito -- en paralelo para no
        // duplicar la espera. OJO: NO alcanza con geocodificar solo cuando
        // buscarContenedoresMapa() no encuentra nada -- "Mac Eachen y Bado"
        // SÍ encuentra contenedores (cualquiera de la calle Mac Eachen, por
        // cómo arma el OR el backend, ver nota arriba de geocodificarDireccion),
        // pero ninguno es la esquina puntual buscada. Por eso se geocodifica
        // siempre que se escribió una calle, tenga o no matches de texto.
        const [resultados, ubicacion] = await Promise.all([
            buscarContenedoresMapa({ direccion, barrio, municipio }),
            direccion ? geocodificarDireccion(direccion) : Promise.resolve(null)
        ]);
        const marcadores = resultados.map((fila) => crearMarcadorContenedor(fila)).filter(Boolean);

        if (ubicacion) {
            // Se encontró una ubicación puntual para lo que se escribió: se
            // la marca SIEMPRE con el pin rojo y se centra el mapa ahí con
            // un zoom cómodo de esquina (17), en vez de fitBounds() sobre
            // los matches de texto (que podían quedar lejos de la esquina
            // real y forzar un zoom muy amplio -- el bug que reportó Matías
            // el 15/10). A propósito NO se activa modoBusquedaMapaActivo:
            // se deja que el recargo normal por bounding box (moveend)
            // traiga los contenedores geográficamente más próximos al pin,
            // un criterio más preciso que el match de texto suelto.
            modoBusquedaMapaActivo = false;
            capaCluster.clearLayers();
            mostrarMarcadorEsquina(mapa, ubicacion.lat, ubicacion.lng, direccion);
            mapa.setView([ubicacion.lat, ubicacion.lng], 17);

            mostrarEstadoBuscadorMapa(
                elementoEstado,
                marcadores.length
                    ? `Mostrando "${direccion}". También hay ${marcadores.length} contenedor${marcadores.length === 1 ? "" : "es"} con esa calle en su dirección (puede que no estén justo en esta esquina) -- los contenedores más próximos al pin deberían verse alrededor.`
                    : `Mostrando "${direccion}". No hay ningún contenedor registrado exactamente ahí -- los contenedores más próximos al pin deberían verse alrededor.`,
                false
            );
            return;
        }

        if (marcadores.length > 0) {
            // No se pudo geocodificar lo escrito (o no se escribió calle,
            // solo barrio/municipio), pero sí hay contenedores que matchean
            // por texto -- mismo comportamiento de siempre.
            modoBusquedaMapaActivo = true;
            capaCluster.clearLayers();
            marcadores.forEach((marcador) => capaCluster.addLayer(marcador));

            mostrarEstadoBuscadorMapa(
                elementoEstado,
                marcadores.length === 1 ? "Se encontró 1 contenedor." : `Se encontraron ${marcadores.length} contenedores.`,
                false
            );

            const grupoResultados = L.featureGroup(marcadores);
            mapa.fitBounds(grupoResultados.getBounds(), { padding: [40, 40], maxZoom: 18 });

            if (marcadores.length === 1) marcadores[0].openPopup();
            return;
        }

        capaCluster.clearLayers();
        mostrarEstadoBuscadorMapa(
            elementoEstado,
            direccion
                ? "No se encontraron contenedores ni una dirección reconocible con esos criterios."
                : "No se encontraron contenedores con esos criterios.",
            true
        );
    });

    if (botonLimpiar) {
        botonLimpiar.addEventListener("click", () => {
            formulario.reset();
            if (listaResultadosCalle) {
                listaResultadosCalle.hidden = true;
                listaResultadosCalle.innerHTML = "";
            }
            ocultarMarcadorEsquina(mapa);
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

    // modoBusquedaMapaActivo se pausa acá: antes se seteaba en
    // inicializarBuscadorMapa() pero nada lo leía, así que el fitBounds()
    // que usa el buscador para centrar los resultados disparaba este mismo
    // moveend y los pisaba enseguida con lo que entraba en el nuevo
    // viewport -- el buscador "no hacía nada" porque el resultado
    // desaparecía casi al instante.
    const recargarDebounced = debounce(() => {
        if (modoBusquedaMapaActivo) return;
        recargarContenedoresVisibles(mapa, capaClusterContenedores);
    }, ESPERA_RECARGA_MS);
    mapa.on("moveend", recargarDebounced);
    mapa.on("zoomend", recargarDebounced);

    // inicializarBuscadorMapa() pobla los <select> de municipio/barrio y
    // engancha el submit del formulario -- sin este llamado los selects
    // quedaban vacíos y el botón "Buscar en el mapa" no hacía nada porque
    // el <form> nunca tenía un listener propio.
    await Promise.all([
        recargarContenedoresVisibles(mapa, capaClusterContenedores),
        cargarIncidenciasEnMapa(mapa),
        inicializarBuscadorMapa(mapa, capaClusterContenedores)
    ]);
}

document.addEventListener("DOMContentLoaded", cargarMapaIncidencias);
