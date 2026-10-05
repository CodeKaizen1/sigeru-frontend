// Buscador público de incidencias: pide la lista a api-gestion una sola
// vez al cargar y filtra en memoria mientras el vecino escribe.

const API_GESTION_BUSCADOR = "../../api-gestion/index.php";

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

// Copia en memoria de la última lista pedida al servidor.
let incidenciasCache = [];

function pintarResultados() {
    const texto = normalizarBusquedaIncidencia(document.getElementById("buscarIncidencia")?.value || "");

    const enCurso = incidenciasCache.filter((inc) => inc.estadoIncidencia !== "resuelta" && coincideBusqueda(inc, texto));
    const resueltas = incidenciasCache.filter((inc) => inc.estadoIncidencia === "resuelta" && coincideBusqueda(inc, texto));

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
}

// Global a propósito: la llama app.js al guardar un aviso nuevo, sin recargar la página.
async function actualizarBuscadorIncidencias() {
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
});
