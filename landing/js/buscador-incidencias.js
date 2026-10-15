// Buscador público de incidencias: pide la lista a api-gestion una sola
// vez al cargar y filtra en memoria mientras el vecino escribe.

const API_GESTION_BUSCADOR = "../../api-gestion/index.php";

// Por defecto solo se muestran las primeras incidencias de cada columna
// (pedido de Matías: la lista completa quedaba larguísima) -- "Ver todas"
// destapa el resto, y buscar siempre busca sobre el total, no solo sobre
// lo que está visible.
const LIMITE_INCIDENCIAS_VISIBLES = 5;

let verTodasEnCurso = false;
let verTodasResueltas = false;

// El endpoint de incidencia acepta POST sin sesión (lo necesita el formulario
// público), así que lo que vuelve en la respuesta no se puede asumir seguro:
// alguien puede mandar HTML directo con curl/Postman sin pasar por el
// formulario. Se escapa todo lo que viene del servidor antes de pintarlo
// (mismo patrón que escapeHtml() en backoffice/js/admin/view.js).
function escapeHtml(valor) {
    return String(valor ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

function normalizarBusquedaIncidencia(texto) {
    return texto.toString().toLowerCase();
}

function formatearFechaReporte(fechaMysql) {
    if (!fechaMysql) return "";

    // Se reemplaza el espacio por "T" para que new Date() lo lea en todos los navegadores.
    const fecha = new Date(fechaMysql.replace(" ", "T"));
    if (isNaN(fecha.getTime())) return "";

    const fechaTexto = fecha.toLocaleDateString("es-UY");
    const horaTexto = fecha.toLocaleTimeString("es-UY", { hour: "2-digit", minute: "2-digit" });
    return `Reportada el ${fechaTexto} a las ${horaTexto}`;
}

// ms desde época para poder ordenar -- Infinity si la fecha viene vacía o
// rota, para que esas queden al final en vez de arriba de todo.
function marcaDeTiempo(fechaMysql) {
    if (!fechaMysql) return -Infinity;
    const fecha = new Date(fechaMysql.replace(" ", "T"));
    return isNaN(fecha.getTime()) ? -Infinity : fecha.getTime();
}

function claseEstadoIncidencia(estado) {
    return escapeHtml((estado || "").toLowerCase().replaceAll(" ", "-"));
}

function crearTarjetaIncidencia(incidencia) {
    const fechaTexto = formatearFechaReporte(incidencia.fechaReporte);
    const idTexto = escapeHtml(incidencia.idIncidencia);
    const tipoTexto = escapeHtml(incidencia.tipoIncidencia || "Otra situación");
    const zonaTexto = escapeHtml(incidencia.zonaIncidencia || "");
    const estadoTexto = escapeHtml(incidencia.estadoIncidencia || "");

    return `
        <div class="incidencia-publica-card">
            <div>
                <span class="incidencia-publica-id">#${idTexto} — ${tipoTexto}</span>
                <span class="incidencia-publica-detalle">${zonaTexto}</span>
                ${fechaTexto ? `<span class="incidencia-publica-fecha-resolucion">${escapeHtml(fechaTexto)}</span>` : ""}
            </div>
            <span class="estado estado-${claseEstadoIncidencia(incidencia.estadoIncidencia)}">${estadoTexto}</span>
        </div>
    `;
}

function coincideBusqueda(incidencia, texto) {
    if (!texto) return true;

    const campos = [incidencia.idIncidencia, incidencia.zonaIncidencia, incidencia.tipoIncidencia, incidencia.descripcionIncidencia]
        .filter(Boolean)
        .join(" ");

    return normalizarBusquedaIncidencia(campos).includes(texto);
}

function pintarListado(contenedorId, incidencias, mensajeVacio) {
    const contenedor = document.getElementById(contenedorId);
    if (!contenedor) return;

    if (incidencias.length === 0) {
        contenedor.innerHTML = `<p class="empty-state">${mensajeVacio}</p>`;
        return;
    }

    contenedor.innerHTML = incidencias.map(crearTarjetaIncidencia).join("");
}

// Actualiza un botón "Ver todas (N)" / "Ver menos": se oculta si no hace
// falta (no hay más que el límite por defecto).
function actualizarBotonVerTodas(boton, total, verTodas) {
    if (!boton) return;

    if (total <= LIMITE_INCIDENCIAS_VISIBLES) {
        boton.hidden = true;
        return;
    }

    boton.hidden = false;
    boton.textContent = verTodas ? "Ver menos" : `Ver todas (${total})`;
}

// Copia en memoria de la última lista pedida al servidor.
let incidenciasCache = [];

// Punto 17 de la Fase 2 (auditoría 08/10/2026): "en curso" se ordena por más
// ANTIGUA primero (la que lleva más tiempo sin resolver es probablemente la
// que más le importa a quien reportó, y antes quedaba tapada detrás de "Ver
// todas" por mostrarse siempre las más recientes). Las fechas faltantes o
// rotas (-Infinity, ver marcaDeTiempo) igual van al final, no al principio.
function compararPorAntiguedad(a, b) {
    const ta = marcaDeTiempo(a.fechaReporte);
    const tb = marcaDeTiempo(b.fechaReporte);
    if (ta === -Infinity && tb === -Infinity) return 0;
    if (ta === -Infinity) return 1;
    if (tb === -Infinity) return -1;
    return ta - tb;
}

function pintarResultados() {
    const texto = normalizarBusquedaIncidencia(document.getElementById("buscarIncidencia")?.value || "");

    const coincidentes = incidenciasCache.filter((inc) => coincideBusqueda(inc, texto));

    // "Resueltas" sigue mostrando las más recientes primero (tiene sentido
    // ahí, es un historial) -- solo "en curso" se invierte, ver
    // compararPorAntiguedad arriba.
    const enCursoTotal = coincidentes.filter((inc) => inc.estadoIncidencia !== "resuelta").sort(compararPorAntiguedad);
    const resueltasTotal = coincidentes
        .filter((inc) => inc.estadoIncidencia === "resuelta")
        .sort((a, b) => marcaDeTiempo(b.fechaReporte) - marcaDeTiempo(a.fechaReporte));

    // Mientras se busca se muestran todas las coincidencias -- el límite por
    // defecto es solo para la vista inicial, sin texto escrito.
    const enCurso = (!texto && !verTodasEnCurso) ? enCursoTotal.slice(0, LIMITE_INCIDENCIAS_VISIBLES) : enCursoTotal;
    const resueltas = (!texto && !verTodasResueltas) ? resueltasTotal.slice(0, LIMITE_INCIDENCIAS_VISIBLES) : resueltasTotal;

    pintarListado(
        "resultadosIncidenciasEnCurso",
        enCurso,
        texto ? "No se encontraron incidencias en curso con esa búsqueda." : "No hay incidencias en curso por el momento."
    );

    pintarListado(
        "resultadosIncidenciasResueltas",
        resueltas,
        texto ? "No se encontraron incidencias resueltas con esa búsqueda." : "Todavía no hay incidencias resueltas."
    );

    const botonEnCurso = document.getElementById("verTodasEnCurso");
    const botonResueltas = document.getElementById("verTodasResueltas");

    if (texto) {
        // Buscando ya se ve todo lo que coincide: el botón no aporta nada.
        if (botonEnCurso) botonEnCurso.hidden = true;
        if (botonResueltas) botonResueltas.hidden = true;
    } else {
        actualizarBotonVerTodas(botonEnCurso, enCursoTotal.length, verTodasEnCurso);
        actualizarBotonVerTodas(botonResueltas, resueltasTotal.length, verTodasResueltas);
    }
}

// Punto 15 de la Fase 2 (auditoría 08/10/2026): pinta "Cargando..." en las 2
// columnas mientras se espera la respuesta -- solo tiene sentido en la carga
// inicial (ver esCargaInicial en actualizarBuscadorIncidencias), antes de
// tener ningún dato en incidenciasCache.
function pintarCargandoBuscador() {
    const enCurso = document.getElementById("resultadosIncidenciasEnCurso");
    const resueltas = document.getElementById("resultadosIncidenciasResueltas");
    if (enCurso) enCurso.innerHTML = `<p class="empty-state">Cargando...</p>`;
    if (resueltas) resueltas.innerHTML = `<p class="empty-state">Cargando...</p>`;
}

// Global a propósito: la llama app.js al guardar un aviso nuevo, sin recargar la página.
async function actualizarBuscadorIncidencias() {
    // Antes, mientras llegaba esta respuesta, las 2 columnas quedaban vacías
    // sin ningún aviso -- podía leerse como que no había incidencias
    // todavía. En refrescos posteriores (ej. tras reportar una nueva, ver
    // app.js) ya hay algo en incidenciasCache para seguir mostrando, así que
    // no hace falta tapar la lista con "Cargando..." de nuevo.
    const esCargaInicial = incidenciasCache.length === 0;
    if (esCargaInicial) {
        pintarCargandoBuscador();
    }

    try {
        const respuesta = await fetch(`${API_GESTION_BUSCADOR}?recurso=incidencia`, {
            credentials: "same-origin"
        });
        const datos = await respuesta.json().catch(() => null);

        if (respuesta.ok && Array.isArray(datos)) {
            incidenciasCache = datos;
        }
    } catch (error) {
        // Si falla, se sigue mostrando la última copia en memoria.
    }

    pintarResultados();
}

document.addEventListener("DOMContentLoaded", () => {
    if (!document.getElementById("resultadosIncidenciasEnCurso")) return;

    actualizarBuscadorIncidencias();

    const buscador = document.getElementById("buscarIncidencia");
    if (buscador) {
        buscador.addEventListener("input", pintarResultados);
    }

    const botonEnCurso = document.getElementById("verTodasEnCurso");
    if (botonEnCurso) {
        botonEnCurso.addEventListener("click", () => {
            verTodasEnCurso = !verTodasEnCurso;
            pintarResultados();
        });
    }

    const botonResueltas = document.getElementById("verTodasResueltas");
    if (botonResueltas) {
        botonResueltas.addEventListener("click", () => {
            verTodasResueltas = !verTodasResueltas;
            pintarResultados();
        });
    }
});
