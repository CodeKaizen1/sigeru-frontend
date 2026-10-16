// Punto 27 de la Fase 4: Listado (filas de la tabla) + paginador -- mismo
// bloque que en el view.js original.
import { escapeHtml, claseEstado } from "./helpers.js";

function crearFila(modulo, registro) {
    if (modulo === "incidencias") {
        // Un <button> no puede contener otro <button>: se envuelve en un div para agrupar los botones rápidos.
        return `
            <div class="data-row-envoltura">
                <button class="data-row" data-id="${registro.id}" type="button">
                    <span class="data-id">${registro.id}</span>
                    <span>
                        <span class="data-main">${escapeHtml(registro.tipo)}</span>
                        <span class="data-sub">${escapeHtml(registro.zona)}</span>
                        <span class="data-sub data-sub-direccion">${escapeHtml(registro.contenedor)}</span>
                    </span>
                    <span class="estado estado-${claseEstado(registro.estado)}">${escapeHtml(registro.estado)}</span>
                    <span class="data-sub">${escapeHtml(registro.fecha)}</span>
                </button>
                <button type="button" class="btn-fila-rapido" data-asignar-fila="${registro.id}">
                    Asignar
                </button>
                <button type="button" class="btn-fila-rapido" data-cambiar-estado-fila="${registro.id}">
                    Cambiar estado
                </button>
            </div>
        `;
    }

    if (modulo === "contenedores") {
        // Un contenedor sin ubicación queda "en depósito" como repuesto.
        const ubicacionTexto = registro.ubicacion && registro.ubicacion.trim()
            ? registro.ubicacion
            : "En depósito (repuesto)";

        const subUbicacion = registro.zona
            ? `${registro.zona} · ${registro.capacidad}`
            : registro.capacidad;

        return `
            <button class="data-row" data-id="${registro.id}" type="button">
                <span class="data-id">${registro.id}</span>
                <span>
                    <span class="data-main">${escapeHtml(ubicacionTexto)}</span>
                    <span class="data-sub">${escapeHtml(subUbicacion)}</span>
                </span>
                <span class="estado estado-${claseEstado(registro.estado)}">${escapeHtml(registro.estado)}</span>
                <span class="data-sub">${escapeHtml(registro.tipoResiduo)}</span>
            </button>
        `;
    }

    if (modulo === "camiones") {
        return `
            <div class="data-row-envoltura">
                <button class="data-row" data-id="${registro.id}" type="button">
                    <span class="data-id">${registro.id}</span>
                    <span>
                        <span class="data-main">${escapeHtml(registro.marca)} ${escapeHtml(registro.modelo)}</span>
                        <span class="data-sub">${escapeHtml(registro.matricula)} — ${escapeHtml(registro._rutaResumen)}</span>
                    </span>
                    <span class="estado estado-${claseEstado(registro.estado)}">${escapeHtml(registro.estado)}</span>
                    <span class="data-sub">${escapeHtml(registro.capacidad)}</span>
                </button>
                <button type="button" class="btn-fila-rapido" data-asignar-fila="${registro.id}">
                    Asignar
                </button>
            </div>
        `;
    }

    if (modulo === "cuadrillas") {
        return `
            <div class="data-row-envoltura">
                <button class="data-row" data-id="${registro.id}" type="button">
                    <span class="data-id">${registro.id}</span>
                    <span>
                        <span class="data-main">Jefe: ${escapeHtml(registro._jefeNombre)}</span>
                        <span class="data-sub">Chofer: ${escapeHtml(registro._choferNombre)}</span>
                    </span>
                    <span class="data-sub">${registro._operariosCantidad} operario(s)</span>
                    <span class="data-sub data-sub-truncado" title="${escapeHtml(registro._rutaResumen)}">${escapeHtml(registro._rutaResumen)}</span>
                </button>
                <button type="button" class="btn-fila-rapido" data-asignar-fila="${registro.id}">
                    Asignar
                </button>
            </div>
        `;
    }

    if (modulo === "rutas") {
        return `
            <button class="data-row" data-id="${registro.id}" type="button">
                <span class="data-id">${registro.id}</span>
                <span>
                    <span class="data-main">${escapeHtml(registro.nombre || registro.zona)}</span>
                    <span class="data-sub">${registro.nombre ? `${escapeHtml(registro.zona)} — ` : ""}${escapeHtml(registro.horario)} — ${escapeHtml(registro._cuadrillaResumen)}</span>
                </span>
                <span class="estado estado-${claseEstado(registro.estadoAdmin)}">${escapeHtml(registro.estadoAdmin)}</span>
                <span class="data-sub">${escapeHtml(registro.frecuencia)}</span>
            </button>
        `;
    }

    if (modulo === "centrosDeAcopio" || modulo === "vertederos") {
        return `
            <button class="data-row" data-id="${registro.id}" type="button">
                <span class="data-id">${registro.id}</span>
                <span>
                    <span class="data-main">${escapeHtml(registro.nombre)}</span>
                    <span class="data-sub">${escapeHtml(registro.ubicacion)}</span>
                </span>
                <span class="estado estado-${claseEstado(registro.estado)}">${escapeHtml(registro.estado)}</span>
                <span class="data-sub">${escapeHtml(registro.capacidad)}</span>
            </button>
        `;
    }

    if (modulo === "funcionarios") {
        return `
            <button class="data-row" data-id="${registro.id}" type="button">
                <span class="data-id">${registro.id}</span>
                <span>
                    <span class="data-main">${escapeHtml(registro.nombre)} ${escapeHtml(registro.apellido)}</span>
                    <span class="data-sub">${escapeHtml(registro.rol)}</span>
                </span>
                <span class="estado estado-${claseEstado(registro.estado)}">${escapeHtml(registro.estado)}</span>
                <span class="data-sub">${escapeHtml(registro.telefono)}</span>
            </button>
        `;
    }

    if (modulo === "solicitudes") {
        return `
            <button class="data-row" data-id="${registro.id}" type="button">
                <span class="data-id">${registro.id}</span>
                <span>
                    <span class="data-main">${escapeHtml(registro.nombre)} ${escapeHtml(registro.apellido)}</span>
                    <span class="data-sub">${escapeHtml(registro.email)}</span>
                </span>
                <span class="estado estado-pendiente">pendiente</span>
                <span class="data-sub">${escapeHtml(registro.fecha)}</span>
            </button>
        `;
    }
}

// Punto 16 de la Fase 2 (auditoría 08/10/2026) + punto 21 de la Fase 3
// (encabezado de columnas, que como efecto secundario también resuelve):
// encabezado clickeable arriba del listado, con el mismo grid de 4 columnas
// que .data-row (ver admin.css) para que quede alineado con las filas de
// abajo. "columnas" viene de configuracionModulos[modulo].columnasListado
// (controller.js la pasa -- esta vista no decide reglas de negocio, solo
// pinta) y es un array de hasta 4 {etiqueta, campo, tipo}; una columna sin
// "campo" se pinta como texto plano, no clickeable (ej. el "pendiente" fijo
// de Solicitudes, que no tiene sentido ordenar). "ordenActual" es
// {campo, direccion} o null si no hay ningún orden aplicado todavía.
function renderEncabezadoListado(columnas, ordenActual) {
    if (!columnas || !columnas.length) return "";

    const celdas = columnas.map(({ etiqueta, campo }) => {
        if (!campo) {
            return `<span class="col-encabezado">${escapeHtml(etiqueta)}</span>`;
        }

        const esActiva = ordenActual && ordenActual.campo === campo;
        const flecha = esActiva ? (ordenActual.direccion === "desc" ? "▼" : "▲") : "";

        return `
            <button type="button" class="col-encabezado col-ordenable${esActiva ? " col-ordenable-activa" : ""}" data-ordenar-campo="${escapeHtml(campo)}">
                ${escapeHtml(etiqueta)}${flecha ? ` <span class="col-orden-flecha">${flecha}</span>` : ""}
            </button>
        `;
    }).join("");

    return `<div class="data-row-header">${celdas}</div>`;
}

// Pinta la lista y devuelve el elemento contenedor (el controlador escucha los clicks sobre las filas).
export function renderListaRegistros(modulo, registros, columnas, ordenActual) {
    const lista = document.getElementById("moduleList");
    const encabezado = renderEncabezadoListado(columnas, ordenActual);

    if (registros.length === 0) {
        lista.innerHTML = `
            ${encabezado}
            <div class="empty-state">
                No se encontraron registros con los filtros aplicados.
            </div>
        `;
        return lista;
    }

    lista.innerHTML = encabezado + registros.map((registro) => crearFila(modulo, registro)).join("");
    return lista;
}

// Controles de página (Anterior/Página X de Y/Siguiente) debajo del listado.
// Con los ~11.130 contenedores oficiales de la IMM cargados, pintar todo el
// listado filtrado de una (como antes) congela el panel -- mostrarModulo()
// en controller.js ahora solo pasa a renderListaRegistros() la página
// actual y usa esto para que se pueda navegar entre el resto. Si todo entra
// en una sola página, queda vacío (y oculto, ver .paginador:empty en CSS).
export function renderPaginador(paginaActual, totalPaginas) {
    const contenedor = document.getElementById("paginador");
    if (!contenedor) return null;

    if (totalPaginas <= 1) {
        contenedor.innerHTML = "";
        return contenedor;
    }

    contenedor.innerHTML = `
        <button type="button" class="btn-secundario" data-pagina-anterior ${paginaActual <= 1 ? "disabled" : ""}>Anterior</button>
        <span>Página ${paginaActual} de ${totalPaginas}</span>
        <label class="paginador-ir">
            Ir a
            <input type="number" min="1" max="${totalPaginas}" value="${paginaActual}" data-pagina-input>
        </label>
        <button type="button" class="btn-secundario" data-pagina-siguiente ${paginaActual >= totalPaginas ? "disabled" : ""}>Siguiente</button>
    `;

    return contenedor;
}
