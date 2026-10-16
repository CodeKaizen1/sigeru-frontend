// Punto 27 de la Fase 4: Encabezado y controles del módulo -- mismo bloque
// que en el view.js original (título/descripción/buscador/filtros arriba de
// la lista). Sin dependencias internas: solo manipula el DOM directamente,
// ningún otro archivo de view/ le hace falta.

export function actualizarEncabezadoModulo(config) {
    document.getElementById("moduleTitle").textContent = config.titulo;
    document.getElementById("moduleDescription").textContent = config.descripcion;

    // Placeholder del buscador dinámico por módulo (Fase 2, punto 11): antes
    // era un texto fijo en admin.html que mencionaba campos que no todos los
    // módulos tienen. Si el módulo no define uno propio, se deja un texto genérico.
    document.getElementById("searchInput").placeholder =
        config.placeholderBusqueda || "Buscar...";
}

export function actualizarFiltroEstados(estados) {
    const filtro = document.getElementById("stateFilter");

    filtro.innerHTML = `<option value="todos">Todos los estados</option>`;

    estados.forEach((estado) => {
        filtro.innerHTML += `<option value="${estado}">${estado}</option>`;
    });
}

export function limpiarBusqueda() {
    document.getElementById("searchInput").value = "";
}

export function mostrarHerramientasModulo(esResumen) {
    document.getElementById("moduleTools").style.display = esResumen ? "none" : "grid";
}

// En Resumen el listado comparte pantalla con el panel fijo; en el resto ocupa todo el ancho.
export function actualizarLayoutModulo(esResumen) {
    document.getElementById("moduleContent").classList.toggle("module-content--solo-lista", !esResumen);
}

export function actualizarBotonNuevo(configAlta) {
    const nuevoBtn = document.getElementById("newRecordBtn");

    if (configAlta) {
        nuevoBtn.style.display = "inline-flex";
        nuevoBtn.textContent = `+ ${configAlta.titulo}`;
    } else {
        nuevoBtn.style.display = "none";
    }
}

// Visible solo en los módulos que tienen exportación configurada.
export function actualizarBotonExportar(visible) {
    const exportBtn = document.getElementById("exportBtn");
    exportBtn.style.display = visible ? "inline-flex" : "none";
}

// Arma la fila de filtros extra por módulo (selects + fecha, si corresponde).
export function renderFiltrosExtra(filtros, tieneFiltroFecha) {
    const contenedor = document.getElementById("filtrosExtra");

    const camposHtml = filtros.map((filtro) => `
        <select id="filtroExtra-${filtro.campo}" data-campo-filtro="${filtro.campo}" aria-label="${filtro.etiqueta}">
            <option value="todos">${filtro.todosLabel}</option>
            ${filtro.opciones.map((opcion) => `<option value="${opcion}">${opcion}</option>`).join("")}
        </select>
    `).join("");

    const fechaHtml = tieneFiltroFecha ? `
        <input type="date" id="dateFilter" aria-label="Filtrar por fecha" title="Filtrar por fecha">
    ` : "";

    contenedor.innerHTML = camposHtml + fechaHtml;
    contenedor.classList.toggle("oculto", !filtros.length && !tieneFiltroFecha);
}
