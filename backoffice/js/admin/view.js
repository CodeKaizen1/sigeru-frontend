// VISTA
// Funciones que arman/actualizan el HTML del panel administrador a partir
// de datos ya resueltos. No decide reglas de negocio, solo pinta.

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

// Arma <option> a partir de una lista; textoBusqueda (opcional) define el texto filtrable por activarBuscador().
function crearOpciones(lista, idSeleccionado, etiqueta, textoBusqueda, estadoFn) {
    return lista.map((item) => {
        const atributoBusqueda = textoBusqueda
            ? ` data-busqueda="${escapeHtml(normalizarBusqueda(textoBusqueda(item)))}"`
            : "";
        const atributoEstado = estadoFn ? ` data-estado="${escapeHtml(estadoFn(item))}"` : "";

        return `
        <option value="${item.id}"${atributoBusqueda}${atributoEstado} ${item.id === idSeleccionado ? "selected" : ""}>${escapeHtml(etiqueta(item))}</option>
    `;
    }).join("");
}

// Normaliza a minúsculas para comparar en el buscador.
function normalizarBusqueda(texto) {
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

// Mismo buscador de arriba, combinado con un <select> que filtra por
// data-estado ("libre"/"asignado") -- para separar en Jefe/Chofer/Operarios
// de la cuadrilla a quién está libre de quién ya está asignado a otra, sin
// mezclarlos en una sola lista. Los dos filtros se aplican juntos (un item
// solo queda visible si pasa el texto Y el estado elegido).
export function activarBuscadorConFiltroEstado(inputId, selectId, itemsSelector) {
    const input = document.getElementById(inputId);
    const select = document.getElementById(selectId);
    if (!input || !select) return;

    input.addEventListener("keydown", (evento) => {
        if (evento.key === "Enter") evento.preventDefault();
    });

    function aplicarFiltros() {
        const texto = normalizarBusqueda(input.value);
        const estado = select.value;
        document.querySelectorAll(itemsSelector).forEach((item) => {
            const coincideTexto = !texto || (item.dataset.busqueda || "").includes(texto);
            const coincideEstado = !estado || item.dataset.estado === estado;
            item.style.display = (coincideTexto && coincideEstado) ? "" : "none";
        });
    }

    input.addEventListener("input", aplicarFiltros);
    select.addEventListener("change", aplicarFiltros);
}

//
// Encabezado y controles del módulo
//

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

//
// Resumen
//

export function mostrarTarjetasResumen(stats) {
    const resumen = document.getElementById("summaryCards");
    resumen.style.display = "grid";

    resumen.innerHTML = `
        <article class="resumen-card">
            <span>Incidencias abiertas</span>
            <strong>${stats.incidenciasAbiertas}</strong>
        </article>

        <article class="resumen-card">
            <span>Contenedores registrados</span>
            <strong>${stats.totalContenedores}</strong>
        </article>

        <article class="resumen-card">
            <span>Camiones registrados</span>
            <strong>${stats.totalCamiones}</strong>
        </article>

        <article class="resumen-card">
            <span>Funcionarios activos</span>
            <strong>${stats.funcionariosActivos}</strong>
        </article>

        <article class="resumen-card">
            <span>Solicitudes pendientes</span>
            <strong>${stats.solicitudesPendientes}</strong>
        </article>
    `;
}

export function ocultarTarjetasResumen() {
    document.getElementById("summaryCards").style.display = "none";
}

// Colores de estado -- mismos 4 significados que ya usan las etiquetas
// ".estado-*" de components.css/admin.css (rojo = problema, ámbar = en
// curso/intermedio, verde = bien, gris = baja/neutral), para que el color de
// cada barra coincida con el de la etiqueta de estado en el resto del panel.
const COLOR_ESTADO = {
    abierta: "#b42318",
    roto: "#b42318",
    "en curso": "#946200",
    desbordado: "#946200",
    resuelta: "#137a3a",
    funcional: "#137a3a",
    baja: "#55606b"
};

// Paleta categórica (identidad, no estado) para "tipo" y "frecuencia" --
// validada con dataviz/scripts/validate_palette.js (separación suficiente
// para daltonismo). Se repiten en el mismo orden en los dos gráficos que la
// usan, para que cada categoría mantenga siempre el mismo color.
const PALETA_CATEGORICA = ["#2f7fca", "#0a8a5c", "#7c3aed", "#d4722b", "#c2298f"];

let graficosResumen = [];

// Arma un gráfico de barras horizontales: una barra por categoría, con la
// cantidad ya incluida en la etiqueta del eje (así el valor se lee sin pasar
// el mouse) y el color de cada barra fijo por categoría, no por posición/
// cantidad -- un filtro o un cambio de datos nunca le repinta el color a otra
// categoría.
function crearGraficoBarras(canvas, distribucion, coloresPorCategoria) {
    return new Chart(canvas, {
        type: "bar",
        data: {
            labels: distribucion.map((fila) => `${fila.categoria} (${fila.cantidad})`),
            datasets: [{
                data: distribucion.map((fila) => fila.cantidad),
                backgroundColor: distribucion.map((fila, indice) => coloresPorCategoria[fila.categoria] || coloresPorCategoria[indice] || "#5f6f82"),
                borderRadius: 4,
                maxBarThickness: 28
            }]
        },
        options: {
            indexAxis: "y",
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        // El label del eje ya trae "(cantidad)" -- en el tooltip
                        // alcanza con el nombre de la categoría, sin repetirlo.
                        title: (items) => items[0].label.replace(/\s*\(\d+\)$/, "")
                    }
                }
            },
            scales: {
                x: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: "#eceff3" } },
                y: { grid: { display: false } }
            }
        }
    });
}

// Pinta los 4 gráficos de distribución del Resumen (reemplaza el mensaje
// inicial de "Seleccione un módulo..." en moduleList, que en esta pantalla
// no tenía uso real). Destruye los gráficos previos antes de volver a armar
// el HTML -- necesario si se entra y sale de Resumen más de una vez.
export function renderGraficosResumen(stats) {
    graficosResumen.forEach((grafico) => grafico.destroy());
    graficosResumen = [];

    document.getElementById("moduleList").innerHTML = `
        <div class="graficos-resumen">
            <article class="grafico-card">
                <h3>Incidencias por estado</h3>
                <div class="grafico-lienzo"><canvas id="graficoIncidenciasEstado"></canvas></div>
            </article>

            <article class="grafico-card">
                <h3>Incidencias por tipo</h3>
                <div class="grafico-lienzo"><canvas id="graficoIncidenciasTipo"></canvas></div>
            </article>

            <article class="grafico-card">
                <h3>Contenedores por estado</h3>
                <div class="grafico-lienzo"><canvas id="graficoContenedoresEstado"></canvas></div>
            </article>

            <article class="grafico-card">
                <h3>Rutas por frecuencia</h3>
                <div class="grafico-lienzo"><canvas id="graficoRutasFrecuencia"></canvas></div>
            </article>
        </div>
    `;

    graficosResumen.push(
        crearGraficoBarras(document.getElementById("graficoIncidenciasEstado"), stats.incidenciasPorEstado, COLOR_ESTADO),
        crearGraficoBarras(document.getElementById("graficoIncidenciasTipo"), stats.incidenciasPorTipo, PALETA_CATEGORICA),
        crearGraficoBarras(document.getElementById("graficoContenedoresEstado"), stats.contenedoresPorEstado, COLOR_ESTADO),
        crearGraficoBarras(document.getElementById("graficoRutasFrecuencia"), stats.rutasPorFrecuencia, PALETA_CATEGORICA)
    );
}

export function mostrarMensajeDetalleInicial() {
    document.getElementById("detailPanel").innerHTML = `
        <p class="detail-empty">
            En esta vista se muestra un resumen general. Para ver detalles,
            ingrese a cualquiera de los módulos del menú lateral.
        </p>
    `;
}

// Pinta en el panel de detalle de Resumen las últimas incidencias reportadas.
export function renderUltimasIncidencias(incidencias) {
    const detalle = document.getElementById("detailPanel");

    if (incidencias.length === 0) {
        detalle.innerHTML = `
            <p class="detail-empty">
                Todavía no hay incidencias reportadas.
            </p>
        `;
        return;
    }

    const filas = incidencias
        .map((incidencia) => `
            <div class="resumen-incidencia">
                <div class="resumen-incidencia-info">
                    <span class="resumen-incidencia-id">${incidencia.id} — ${escapeHtml(incidencia.tipo)}</span>
                    <span class="data-sub">${escapeHtml(incidencia.zona)} · ${escapeHtml(incidencia.fecha)}</span>
                </div>
                <span class="estado estado-${claseEstado(incidencia.estado)}">${escapeHtml(incidencia.estado)}</span>
            </div>
        `)
        .join("");

    detalle.innerHTML = `
        <h3>Últimas incidencias</h3>
        <p>Los ${incidencias.length} reportes más recientes.</p>

        <div class="resumen-incidencias-lista">
            ${filas}
        </div>
    `;
}

//
// Informe de incidencias (Fase 4, punto 15)
//

let graficoInforme = null;

// Pinta el informe completo (filtros + tarjetas de totales + gráfico + tabla)
// dentro de moduleList, igual que Resumen hace con sus gráficos -- se
// reconstruye entero en cada cambio de filtro, controller.js reengancha los
// listeners después de llamar a esto.
export function renderInformeIncidencias({ filtros, zonas, tipos, informe }) {
    const opcionesZona = zonas.map((zona) => `<option value="${escapeHtml(zona)}" ${zona === filtros.zona ? "selected" : ""}>${escapeHtml(zona)}</option>`).join("");
    const opcionesTipo = tipos.map((tipo) => `<option value="${escapeHtml(tipo)}" ${tipo === filtros.tipo ? "selected" : ""}>${escapeHtml(tipo)}</option>`).join("");

    const LIMITE_FILAS_TABLA = 300;
    const filasTabla = informe.filas.slice(0, LIMITE_FILAS_TABLA);
    const filasOcultas = informe.filas.length - filasTabla.length;

    const filasHtml = filasTabla.length
        ? filasTabla.map((incidencia) => `
            <tr>
                <td>${incidencia.id}</td>
                <td>${escapeHtml(incidencia.fecha)}</td>
                <td>${escapeHtml(incidencia.tipo)}</td>
                <td>${escapeHtml(incidencia.zona)}</td>
                <td><span class="estado estado-${claseEstado(incidencia.estado)}">${escapeHtml(incidencia.estado)}</span></td>
                <td>${escapeHtml(incidencia.contenedor)}</td>
                <td>${escapeHtml(incidencia.resolucion || "Sin resolver todavía")}</td>
            </tr>
        `).join("")
        : `<tr><td colspan="7" class="empty-state">No hay incidencias que coincidan con estos filtros.</td></tr>`;

    document.getElementById("moduleList").innerHTML = `
        <div class="informe-incidencias">
            <div class="informe-filtros">
                <div class="grupo-formulario">
                    <label for="informeDesde">Desde</label>
                    <input type="date" id="informeDesde" data-informe-desde value="${escapeHtml(filtros.desde)}">
                </div>
                <div class="grupo-formulario">
                    <label for="informeHasta">Hasta</label>
                    <input type="date" id="informeHasta" data-informe-hasta value="${escapeHtml(filtros.hasta)}">
                </div>
                <div class="grupo-formulario">
                    <label for="informeZona">Zona</label>
                    <select id="informeZona" data-informe-zona>
                        <option value="">Todas las zonas</option>
                        ${opcionesZona}
                    </select>
                </div>
                <div class="grupo-formulario">
                    <label for="informeTipo">Tipo</label>
                    <select id="informeTipo" data-informe-tipo>
                        <option value="">Todos los tipos</option>
                        ${opcionesTipo}
                    </select>
                </div>
                <div class="informe-filtros-acciones">
                    <button type="button" class="btn-secundario" data-informe-limpiar>Limpiar filtros</button>
                    <button type="button" class="btn-principal" data-informe-exportar>Exportar a Excel</button>
                </div>
            </div>

            <div class="admin-resumen informe-tarjetas">
                <article class="resumen-card">
                    <span>Total en el período</span>
                    <strong>${informe.total}</strong>
                </article>
                <article class="resumen-card">
                    <span>Abiertas</span>
                    <strong>${informe.abiertas}</strong>
                </article>
                <article class="resumen-card">
                    <span>En curso</span>
                    <strong>${informe.enCurso}</strong>
                </article>
                <article class="resumen-card">
                    <span>Resueltas</span>
                    <strong>${informe.resueltas}</strong>
                </article>
            </div>

            <article class="grafico-card informe-grafico">
                <h3>Incidencias por estado en el período</h3>
                <div class="grafico-lienzo"><canvas id="graficoInformeEstado"></canvas></div>
            </article>

            <div class="informe-tabla-envoltura">
                <table class="informe-tabla">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Fecha</th>
                            <th>Tipo</th>
                            <th>Zona</th>
                            <th>Estado</th>
                            <th>Contenedor</th>
                            <th>Resolución</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filasHtml}
                    </tbody>
                </table>
                ${filasOcultas > 0 ? `
                    <p class="detail-nota informe-tabla-nota">
                        Mostrando las primeras ${LIMITE_FILAS_TABLA} de ${informe.filas.length} incidencias. Exportá a Excel para ver el listado completo.
                    </p>
                ` : ""}
            </div>
        </div>
    `;

    if (graficoInforme) {
        graficoInforme.destroy();
        graficoInforme = null;
    }
    graficoInforme = crearGraficoBarras(document.getElementById("graficoInformeEstado"), informe.porEstado, COLOR_ESTADO);
}

//
// Listado (filas de la tabla)
//

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
                    <span class="data-sub">${escapeHtml(registro._rutaResumen)}</span>
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

// Pinta la lista y devuelve el elemento contenedor (el controlador escucha los clicks sobre las filas).
export function renderListaRegistros(modulo, registros) {
    const lista = document.getElementById("moduleList");

    if (registros.length === 0) {
        lista.innerHTML = `
            <div class="empty-state">
                No se encontraron registros con los filtros aplicados.
            </div>
        `;
        return lista;
    }

    lista.innerHTML = registros.map((registro) => crearFila(modulo, registro)).join("");
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

//
// Popup de detalle de un registro
//

export function abrirDetailModal() {
    document.getElementById("detailModal").classList.remove("oculto");
}

export function cerrarDetailModal() {
    document.getElementById("detailModal").classList.add("oculto");
}

// Botones de acción en modo lectura; Cuadrillas, Solicitudes e Incidencias arman los suyos en renderDetalle.
function crearAccionesHtml(modulo, registro) {
    if (modulo === "cuadrillas" || modulo === "solicitudes" || modulo === "incidencias") return "";

    let botones = `
        <button type="button" class="btn-secundario btn-ancho" data-editar="${registro.id}">
            Editar
        </button>
    `;

    // Rutas usa "estadoAdmin" para esto, no "estado".
    const campoEstado = modulo === "rutas" ? "estadoAdmin" : "estado";
    const esBaja = registro[campoEstado] === "baja";
    const accion = esBaja ? "reactivar" : "baja";
    const texto = esBaja ? "Reactivar" : "Dar de baja";
    const clase = esBaja ? "btn-secundario" : "btn-peligro";

    botones += `
        <button type="button" class="${clase} btn-ancho" data-accion="${accion}" data-id="${registro.id}">
            ${texto}
        </button>
    `;

    return `<div class="detail-actions">${botones}</div>`;
}

// Botones Cancelar/Guardar en modo edición.
function crearAccionesEdicionHtml() {
    return `
        <div class="modal-actions">
            <button type="button" id="detailEditCancelar" class="btn-secundario">Cancelar</button>
            <button type="submit" class="btn-principal">Guardar</button>
        </div>
    `;
}

// Arma el input/select/textarea de un campo editable dentro de la ficha de detalle.
function crearControlDeCampo(campo, valorActual) {
    if (campo.tipo === "select") {
        const opciones = campo.opciones
            .map((opcion) => {
                const valor = typeof opcion === "object" ? opcion.value : opcion;
                const etiqueta = typeof opcion === "object" ? opcion.label : opcion;
                return `<option value="${valor}" ${valor === valorActual ? "selected" : ""}>${etiqueta}</option>`;
            })
            .join("");

        return `<select id="campo-${campo.nombre}" name="${campo.nombre}" ${campo.requerido ? "required" : ""}>${opciones}</select>`;
    }

    if (campo.tipo === "textarea") {
        return `<textarea id="campo-${campo.nombre}" name="${campo.nombre}" rows="3" placeholder="${campo.placeholder || ""}" ${campo.requerido ? "required" : ""}>${escapeHtml(valorActual)}</textarea>`;
    }

    return `<input type="${campo.tipo}" id="campo-${campo.nombre}" name="${campo.nombre}" value="${escapeHtml(valorActual)}" placeholder="${campo.placeholder || ""}" ${campo.requerido ? "required" : ""}>`;
}

function crearDetalleItemEditable(titulo, campo, valorActual) {
    const claseAncho = campo.ancho === "completo" ? " detail-item-completo" : "";

    return `
        <div class="detail-item detail-item-editable${claseAncho}">
            <label for="campo-${campo.nombre}">${titulo}</label>
            ${crearControlDeCampo(campo, valorActual ?? "")}
        </div>
    `;
}

// Pinta la ficha de detalle de un registro (o su versión editable, si se pasa configEdicion).
export function renderDetalle(modulo, registro, datosExtra = {}, configEdicion = null) {
    const detalle = document.getElementById("detailModalBody");
    const enEdicion = Boolean(configEdicion);

    // item: campo de solo lectura si no hay nombreCampo o estamos en modo lectura; editable si el campo está en configEdicion.
    const item = (titulo, valorMostrar, nombreCampo = null, valorEdicion = valorMostrar) => {
        const campo = enEdicion && nombreCampo ? configEdicion.campos.find((c) => c.nombre === nombreCampo) : null;
        return campo ? crearDetalleItemEditable(titulo, campo, valorEdicion) : crearDetalleItem(titulo, valorMostrar);
    };

    // En edición la grilla se acomoda de a dos columnas para que entre todo sin scroll.
    const claseGrid = enEdicion ? "detail-grid detail-grid--edicion" : "detail-grid";

    let contenidoHtml = "";

    if (modulo === "incidencias") {
        const estaResuelta = registro.estado === "resuelta";

        contenidoHtml = `
            <h3>${registro.id}</h3>
            <p>${escapeHtml(registro.descripcion)}</p>

            <div class="detail-grid">
                ${crearDetalleItem("Tipo", registro.tipo)}
                ${crearDetalleItem("Estado", registro.estado)}
                ${crearDetalleItem("Zona", registro.zona)}
                ${registro.direccion ? crearDetalleItem("Dirección", registro.direccion) : ""}
                ${crearDetalleItem("Fecha de reporte", registro.fecha)}
                ${crearDetalleItem("Contenedor asociado", registro.contenedor)}
                ${crearDetalleItem("Cuadrilla asignada", registro.cuadrillaId || "Sin asignar")}
                ${estaResuelta ? crearDetalleItem("Resuelta el", formatearFechaHora(registro.fechaResolucion)) : ""}
            </div>

            ${estaResuelta ? `
                <div class="detail-asignacion">
                    <h4>Qué se hizo para resolverla</h4>
                    <p>${escapeHtml(registro.resolucion)}</p>
                </div>
            ` : ""}
        `;
    }

    if (modulo === "contenedores") {
        const tieneUbicacion = Boolean(registro.ubicacion && registro.ubicacion.trim());
        const ubicacionTexto = tieneUbicacion ? registro.ubicacion : "En depósito (repuesto, sin instalar todavía)";

        contenidoHtml = `
            <h3>${enEdicion ? escapeHtml(configEdicion.tituloEdicion) : registro.id}</h3>
            ${enEdicion ? "" : `<p>${escapeHtml(ubicacionTexto)}</p>`}

            <div class="${claseGrid}">
                ${enEdicion ? item("Ubicación", registro.ubicacion, "ubicacion") : ""}
                ${item("Estado", registro.estado, "estado")}
                ${item("Barrio / zona", registro.zona, "zona")}
                ${item("Municipio", registro.municipio, "municipio")}
                ${item("Capacidad", registro.capacidad, "capacidad")}
                ${item("Tipo de residuo", registro.tipoResiduo, "tipoResiduo")}
                ${item("Incidencias asociadas", registro.incidencias)}
            </div>

            ${!enEdicion && !tieneUbicacion ? `
                <p class="detail-nota">
                    Este contenedor todavía no tiene ubicación: es un repuesto en
                    depósito. Para instalarlo, editalo y completá la Ubicación.
                </p>
            ` : ""}

            ${enEdicion ? crearAccionesEdicionHtml() : crearAccionesHtml(modulo, registro)}
        `;
    }

    if (modulo === "camiones") {
        const cuadrilla = datosExtra.cuadrilla || null;
        const cuadrillaTexto = cuadrilla
            ? `Jefe: ${cuadrilla.jefe ? `${cuadrilla.jefe.nombre} ${cuadrilla.jefe.apellido}` : "sin jefe asignado"}`
            : "Sin cuadrilla asignada";
        const rutaTexto = cuadrilla && cuadrilla.ruta
            ? `${cuadrilla.ruta.nombre || cuadrilla.ruta.zona} — ${cuadrilla.ruta.horario}`
            : "Sin ruta asignada";

        contenidoHtml = `
            <h3>${enEdicion ? escapeHtml(configEdicion.tituloEdicion) : `${escapeHtml(registro.marca)} ${escapeHtml(registro.modelo)}`}</h3>
            ${enEdicion ? "" : `<p>Matrícula ${escapeHtml(registro.matricula)} — Año ${escapeHtml(registro.anio)}</p>`}

            <div class="${claseGrid}">
                ${enEdicion ? item("Matrícula", registro.matricula, "matricula") : ""}
                ${enEdicion ? item("Marca", registro.marca, "marca") : ""}
                ${enEdicion ? item("Modelo", registro.modelo, "modelo") : ""}
                ${enEdicion ? item("Año", registro.anio, "anio") : ""}
                ${item("Disponibilidad", registro.estado, "estado")}
                ${item("Mantenimiento", registro.mantenimiento, "mantenimiento")}
                ${item("Capacidad", registro.capacidad, "capacidad")}
                ${item("Chofer asignado", datosExtra.choferAsignado || "Sin asignar", "choferId", registro.choferId)}
                ${item("Cuadrilla", cuadrillaTexto)}
                ${item("Ruta asignada", rutaTexto)}
            </div>

            ${enEdicion ? "" : `
                <p class="detail-nota">
                    La cuadrilla y la ruta dependen de a qué cuadrilla pertenezca
                    el chofer asignado (se administran desde el módulo Cuadrillas).
                    Para asignarlo, usá el botón "Asignar" al lado de este camión
                    en el listado.
                </p>
            `}

            ${enEdicion ? crearAccionesEdicionHtml() : crearAccionesHtml(modulo, registro)}
        `;
    }

    if (modulo === "cuadrillas") {
        const cuadrillaRaw = datosExtra.cuadrillaRaw;
        const estado = cuadrillaRaw.estado || "activa";
        const esBaja = estado === "baja";
        const claseBotonBaja = esBaja ? "btn-secundario" : "btn-peligro";

        const nombreOSinAsignar = (f) => (f ? `${f.nombre} ${f.apellido}` : "Sin asignar");
        const camionTexto = registro.camion
            ? `${registro.camion.marca} ${registro.camion.modelo} (${registro.camion.matricula})`
            : "Sin camión asignado";
        const rutaTexto = registro.ruta ? `${registro.ruta.nombre || registro.ruta.zona} — ${registro.ruta.horario}` : "Sin asignar";

        // Solo lectura acá; la edición se hace en un popup aparte (ver renderFormularioEdicionCuadrillaEnDetalle).
        const operariosHtml = registro.operarios.length
            ? registro.operarios.map((f) => `
                <div class="operario-card">
                    <span class="operario-card-nombre">${escapeHtml(f.nombre)} ${escapeHtml(f.apellido)}</span>
                </div>
            `).join("")
            : `<p class="detail-empty">Sin operarios asignados.</p>`;

        contenidoHtml = `
            <h3>${registro.id}</h3>
            <p>Estado: <span class="estado estado-${claseEstado(estado)}">${escapeHtml(estado)}</span></p>

            <div class="detail-grid">
                ${crearDetalleItem("Jefe de cuadrilla", nombreOSinAsignar(registro.jefe))}
                ${crearDetalleItem("Chofer", nombreOSinAsignar(registro.chofer))}
                ${crearDetalleItem("Camión", camionTexto)}
                ${crearDetalleItem("Ruta", rutaTexto)}
            </div>

            <div class="detail-asignacion">
                <h4>Operarios de esta cuadrilla</h4>
                <div class="lista-operarios-cuadrilla">${operariosHtml}</div>
            </div>

            <div class="detail-actions">
                <button type="button" class="btn-secundario btn-ancho" data-editar-cuadrilla="${registro.id}">
                    Editar
                </button>
                <button type="button" class="${claseBotonBaja} btn-ancho" data-baja-cuadrilla="${registro.id}">
                    ${esBaja ? "Reactivar cuadrilla" : "Dar de baja cuadrilla"}
                </button>
            </div>
        `;
    }

    if (modulo === "rutas") {
        // estadoAdmin = alta/baja administrativa; estado = seguimiento del recorrido de hoy (solo lectura acá).
        const cuadrilla = datosExtra.cuadrilla || null;
        const cuadrillaTexto = cuadrilla
            ? `${cuadrilla.id} — Jefe: ${cuadrilla.jefe ? `${cuadrilla.jefe.nombre} ${cuadrilla.jefe.apellido}` : "sin jefe asignado"}`
            : "Sin cuadrilla asignada";

        contenidoHtml = `
            <h3>${enEdicion ? escapeHtml(configEdicion.tituloEdicion) : escapeHtml(registro.nombre || registro.zona)}</h3>
            ${enEdicion ? "" : `<p>${escapeHtml(registro.recorrido)}</p>`}

            <div class="${claseGrid}">
                ${enEdicion ? "" : (registro.nombre ? crearDetalleItem("Zona / barrio", registro.zona) : "")}
                ${enEdicion ? item("Zona", registro.zona, "zona") : ""}
                ${enEdicion ? item("Recorrido", registro.recorrido, "recorrido") : ""}
                ${crearDetalleItem("Estado", registro.estadoAdmin)}
                ${item("Frecuencia", registro.frecuencia, "frecuencia")}
                ${item("Horario", registro.horario, "horario")}
                ${crearDetalleItem("Estado del recorrido de hoy", registro.estado)}
                ${crearDetalleItem("Cuadrilla asignada", cuadrillaTexto)}
            </div>

            ${enEdicion ? "" : `
                <p class="detail-nota">
                    El estado del recorrido de hoy lo marca el chofer desde su
                    panel (inicio/fin de la ruta). La cuadrilla se asigna desde
                    el detalle de Cuadrillas, no desde acá.
                </p>
            `}

            ${enEdicion ? crearAccionesEdicionHtml() : crearAccionesHtml(modulo, registro)}
        `;
    }

    if (modulo === "centrosDeAcopio" || modulo === "vertederos") {
        // La maquinaria se edita solo desde el popup de Editar; acá es de solo lectura.
        const maquinaria = datosExtra.maquinaria || [];

        const maquinariaHtml = maquinaria.length
            ? maquinaria.map(enEdicion ? crearMaquinaCardEditable : (maquina) => `
                <div class="maquina-card maquina-card-solo-lectura">
                    <span class="maquina-card-tipo">${escapeHtml(maquina.tipo)}</span>
                    <span class="estado estado-${claseEstado(maquina.estado)}">${escapeHtml(maquina.estado)}</span>
                </div>
            `).join("")
            : "<p class=\"maquina-vacio\">Todavía no hay máquinas registradas en esta instalación.</p>";

        contenidoHtml = `
            <h3>${enEdicion ? escapeHtml(configEdicion.tituloEdicion) : escapeHtml(registro.nombre)}</h3>
            ${enEdicion ? "" : `<p>${escapeHtml(registro.ubicacion)}</p>`}

            <div class="${claseGrid}">
                ${enEdicion ? item("Nombre", registro.nombre, "nombre") : ""}
                ${enEdicion ? item("Ubicación", registro.ubicacion, "ubicacion") : ""}
                ${item("Estado", registro.estado, "estado")}
                ${item("Capacidad", registro.capacidad, "capacidad")}
            </div>

            <div class="detail-asignacion">
                <h4>Maquinaria</h4>
                <div class="lista-maquinaria"${enEdicion ? ' id="modalListaMaquinaria"' : ""}>${maquinariaHtml}</div>

                ${enEdicion ? `
                    <div class="grupo-formulario">
                        <label for="modalNuevaMaquinariaTipo">Nueva máquina</label>
                        <input type="text" id="modalNuevaMaquinariaTipo" placeholder="Ej: Compactadora">
                    </div>
                    <button type="button" class="btn-secundario btn-ancho" id="modalAgregarMaquinaria">
                        Agregar máquina
                    </button>
                ` : `
                    <p class="detail-nota">
                        Para agregar, quitar o cambiar el estado de una máquina,
                        entrá en "Editar".
                    </p>
                `}
            </div>

            ${enEdicion ? crearAccionesEdicionHtml() : crearAccionesHtml(modulo, registro)}
        `;
    }

    if (modulo === "funcionarios") {
        contenidoHtml = `
            <h3>${enEdicion ? escapeHtml(configEdicion.tituloEdicion) : `${escapeHtml(registro.nombre)} ${escapeHtml(registro.apellido)}`}</h3>
            ${enEdicion ? "" : `<p>${escapeHtml(registro.rol)}</p>`}

            <div class="${claseGrid}">
                ${enEdicion ? item("Nombres", registro.nombre, "nombre") : ""}
                ${enEdicion ? item("Apellidos", registro.apellido, "apellido") : ""}
                ${crearDetalleItem("Cédula", registro.cedula)}
                ${crearDetalleItem("Fecha de nacimiento", registro.fechaNacimiento)}
                ${item("Teléfono", registro.telefono, "telefono")}
                ${item("Dirección", registro.direccion, "direccion")}
                ${crearDetalleItem("Correo", registro.email)}
                ${enEdicion ? item("Rol", registro.rol, "rol") : ""}
                ${crearDetalleItem("Estado", registro.estado)}
            </div>

            ${enEdicion ? crearAccionesEdicionHtml() : crearAccionesHtml(modulo, registro)}
        `;
    }

    if (modulo === "solicitudes") {
        const opcionesRol = ["Administrador", "Jefe de Cuadrilla", "Chofer", "Operario de cuadrilla", "Operario de vertedero", "Operario de centro de acopio"]
            .map((rol) => `<option value="${rol}">${rol}</option>`)
            .join("");

        contenidoHtml = `
            <h3>${escapeHtml(registro.nombre)} ${escapeHtml(registro.apellido)}</h3>
            <p>Solicitud enviada el ${escapeHtml(registro.fecha)}</p>

            <div class="detail-grid">
                ${crearDetalleItem("Cédula", registro.cedula)}
                ${crearDetalleItem("Fecha de nacimiento", registro.fechaNacimiento)}
                ${crearDetalleItem("Teléfono", registro.telefono)}
                ${crearDetalleItem("Dirección", registro.direccion)}
                ${crearDetalleItem("Correo", registro.email)}
            </div>

            <div class="detail-asignacion">
                <h4>Aprobar solicitud</h4>

                <div class="grupo-formulario">
                    <label for="solicitudRol-${registro.id}">Rol a asignar</label>
                    <select id="solicitudRol-${registro.id}">
                        ${opcionesRol}
                    </select>
                </div>

                <button type="button" class="btn-principal btn-ancho" data-aprobar-solicitud="${registro.id}">
                    Aprobar y crear cuenta
                </button>
            </div>

            <div class="detail-actions">
                <button type="button" class="btn-peligro btn-ancho" data-rechazar-solicitud="${registro.id}">
                    Rechazar solicitud
                </button>
            </div>
        `;
    }

    detalle.innerHTML = enEdicion ? `<form id="detailEditForm">${contenidoHtml}</form>` : contenidoHtml;
    return detalle;
}

//
// Modal de alta
//

// Fila de filtros compartida por Jefe/Chofer/Operarios: buscador de texto +
// desplegable "Todos/Libres/Ya asignados" (ver activarBuscadorConFiltroEstado
// en controller.js). Reemplaza al agrupado fijo de antes -- la idea es que el
// admin filtre a los libres cuando quiere asignar, en vez de tener que
// revisar una lista mezclada o separada en bloques.
function filaFiltroAsignacion(inputId, selectId) {
    return `
        <div class="fila-filtros-asignacion">
            <input type="text" id="${inputId}" class="input-buscador" placeholder="Buscar por nombre o cédula..." autocomplete="off">
            <select id="${selectId}" class="select-filtro-estado">
                <option value="">Todos</option>
                <option value="libre">Libres</option>
                <option value="asignado">Ya asignados</option>
            </select>
        </div>
    `;
}

// Campos compartidos por el alta y la edición de Cuadrillas.
function construirCamposCuadrillaHtml({ jefes, choferes, rutas, operarios }, cuadrillaRaw = null) {
    const textoBusquedaFuncionario = (f) => `${f.nombre} ${f.apellido} ${f.cedula || ""}`;

    // Model ya anota cada funcionario con _otraCuadrilla ({id, nombre}) cuando
    // ya pertenece a OTRA cuadrilla -- se usa solo para el filtro de arriba
    // (data-estado: "libre"/"asignado"), no se muestra en la propia opción/
    // checkbox (el nombre de la otra cuadrilla puede traer códigos internos
    // feos tipo "(E_DU_RM_CL_111)" que no aportan nada acá). El aviso real
    // es la confirmación al guardar (ver manejarFormularioSubmit/
    // manejarEdicionCuadrillaEnDetalleSubmit) si se elige a alguien "asignado".
    const etiquetaFuncionario = (f) => `${f.nombre} ${f.apellido}`;
    const estadoConflicto = (f) => f._otraCuadrilla ? "asignado" : "libre";

    const opcionesJefe = crearOpciones(jefes, cuadrillaRaw?.jefeId ?? null, etiquetaFuncionario, textoBusquedaFuncionario, estadoConflicto);
    const opcionesChofer = crearOpciones(choferes, cuadrillaRaw?.choferId ?? null, etiquetaFuncionario, textoBusquedaFuncionario, estadoConflicto);
    const opcionesRuta = crearOpciones(rutas, cuadrillaRaw?.rutaId ?? null, (r) => `${r.nombre || r.zona} — ${r.horario}`);
    const operariosDeEstaCuadrilla = cuadrillaRaw?.operarios ?? [];

    const operarioCheckboxHtml = (f) => `
        <label class="checkbox-operario" data-busqueda="${escapeHtml(normalizarBusqueda(textoBusquedaFuncionario(f)))}" data-estado="${estadoConflicto(f)}">
            <input type="checkbox" name="operarios" value="${f.id}" ${operariosDeEstaCuadrilla.includes(f.id) ? "checked" : ""}>
            ${escapeHtml(etiquetaFuncionario(f))}
        </label>
    `;

    const operariosHtml = operarios.length
        ? operarios.map(operarioCheckboxHtml).join("")
        : `<p class="detail-empty">No hay operarios disponibles.</p>`;

    // El camión no se elige acá: sigue al chofer asignado (se empareja desde el módulo Camiones).
    return `
        <div class="grupo-formulario">
            <label for="campoCuadrillaJefe">Jefe de cuadrilla</label>
            ${filaFiltroAsignacion("buscarCuadrillaJefe", "filtroCuadrillaJefe")}
            <select id="campoCuadrillaJefe" name="jefeId">
                <option value="">Sin asignar</option>
                ${opcionesJefe}
            </select>
        </div>

        <div class="grupo-formulario">
            <label for="campoCuadrillaChofer">Chofer</label>
            ${filaFiltroAsignacion("buscarCuadrillaChofer", "filtroCuadrillaChofer")}
            <select id="campoCuadrillaChofer" name="choferId">
                <option value="">Sin asignar</option>
                ${opcionesChofer}
            </select>
        </div>

        <div class="grupo-formulario">
            <label for="campoCuadrillaRuta">Ruta</label>
            <select id="campoCuadrillaRuta" name="rutaId">
                <option value="">Sin asignar</option>
                ${opcionesRuta}
            </select>
        </div>

        <div class="grupo-formulario grupo-formulario-completo">
            <label>Operarios</label>
            ${filaFiltroAsignacion("buscarCuadrillaOperarios", "filtroCuadrillaOperarios")}
            <div class="lista-checkbox-operarios">${operariosHtml}</div>
        </div>

        <p class="detail-nota grupo-formulario-completo">
            El camión ${cuadrillaRaw ? "sigue al chofer elegido - se empareja desde el módulo Camiones." : "de esta cuadrilla va a ser el que tenga asignado el chofer elegido (se empareja desde el módulo Camiones). La ruta se puede dejar sin asignar y completarla después, editando la cuadrilla."}
        </p>
    `;
}

// Arma el modal de alta de cuadrilla (selects poblados + checklist de operarios).
export function renderFormularioAltaCuadrilla(datos) {
    document.getElementById("modalTitulo").textContent = "Nueva cuadrilla";
    document.getElementById("modalFormFields").innerHTML = construirCamposCuadrillaHtml(datos);
}

// Transforma el popup de detalle de una cuadrilla en su formulario de edición.
export function renderFormularioEdicionCuadrillaEnDetalle(cuadrillaRaw, datos) {
    const detalle = document.getElementById("detailModalBody");

    detalle.innerHTML = `
        <h3>Editar cuadrilla ${cuadrillaRaw.id}</h3>
        <form id="detailEditForm">
            <div class="form-grid">${construirCamposCuadrillaHtml(datos, cuadrillaRaw)}</div>
            <div class="modal-actions">
                <button type="button" id="detailEditCancelar" class="btn-secundario">Cancelar</button>
                <button type="submit" class="btn-principal">Guardar</button>
            </div>
        </form>
    `;

    return document.getElementById("detailEditForm");
}

// Arma los campos de un formulario genérico (alta o edición) a partir de la config del módulo.
function construirCamposHtml(config, modo, valoresIniciales) {
    return config.campos.map((campo) => {
        const claseAncho = campo.ancho === "completo" ? "grupo-formulario-completo" : "";
        const valorInicial = modo === "editar" ? (valoresIniciales[campo.nombre] ?? "") : "";

        if (campo.tipo === "select") {
            // Cada opción puede ser un string, o {value, label} cuando el texto mostrado difiere del valor guardado.
            const opciones = campo.opciones
                .map((opcion) => {
                    const valor = typeof opcion === "object" ? opcion.value : opcion;
                    const etiqueta = typeof opcion === "object" ? opcion.label : opcion;
                    return `<option value="${valor}" ${valor === valorInicial ? "selected" : ""}>${etiqueta}</option>`;
                })
                .join("");

            return `
                <div class="grupo-formulario ${claseAncho}">
                    <label for="campo-${campo.nombre}">${campo.etiqueta}</label>
                    <select id="campo-${campo.nombre}" name="${campo.nombre}" ${campo.requerido ? "required" : ""}>
                        ${opciones}
                    </select>
                </div>
            `;
        }

        if (campo.tipo === "textarea") {
            return `
                <div class="grupo-formulario ${claseAncho}">
                    <label for="campo-${campo.nombre}">${campo.etiqueta}</label>
                    <textarea id="campo-${campo.nombre}" name="${campo.nombre}" rows="3" placeholder="${campo.placeholder || ""}" ${campo.requerido ? "required" : ""}>${escapeHtml(valorInicial)}</textarea>
                </div>
            `;
        }

        // minlength/pattern/title son opcionales (hoy solo los usa la
        // contraseña inicial de "Alta de funcionario" - ítem 11 de
        // seguridad: mismo mínimo que ya se pide en registro.html y en
        // "Mi cuenta" > Cambiar contraseña).
        const atributosExtra = [
            campo.minlength ? `minlength="${campo.minlength}"` : "",
            campo.pattern ? `pattern="${campo.pattern}"` : "",
            campo.title ? `title="${escapeHtml(campo.title)}"` : ""
        ].filter(Boolean).join(" ");

        return `
            <div class="grupo-formulario ${claseAncho}">
                <label for="campo-${campo.nombre}">${campo.etiqueta}</label>
                <input type="${campo.tipo}" id="campo-${campo.nombre}" name="${campo.nombre}" value="${escapeHtml(valorInicial)}" placeholder="${campo.placeholder || ""}" ${campo.requerido ? "required" : ""} ${atributosExtra}>
            </div>
        `;
    }).join("");
}

// Pinta el modal de alta genérico; la edición de un registro existente se hace en su propio popup de detalle.
export function renderCamposFormulario(config, modo = "alta", valoresIniciales = {}) {
    document.getElementById("modalTitulo").textContent =
        modo === "editar" ? config.tituloEdicion : config.titulo;

    document.getElementById("modalFormFields").innerHTML = construirCamposHtml(config, modo, valoresIniciales);
}

// Tarjeta de una máquina editable (cambiar estado o quitarla), usada en el popup de Editar.
function crearMaquinaCardEditable(maquina) {
    return `
        <div class="maquina-card">
            <div class="maquina-card-info">
                <span class="maquina-card-tipo">${escapeHtml(maquina.tipo)}</span>
                <span class="estado estado-${claseEstado(maquina.estado)}">${escapeHtml(maquina.estado)}</span>
            </div>
            <div class="maquina-card-acciones">
                <select data-cambiar-estado-maquinaria="${maquina.id}">
                    <option value="funcionando" ${maquina.estado === "funcionando" ? "selected" : ""}>Funcionando</option>
                    <option value="mantenimiento" ${maquina.estado === "mantenimiento" ? "selected" : ""}>En mantenimiento</option>
                    <option value="rota" ${maquina.estado === "rota" ? "selected" : ""}>Rota</option>
                </select>
                <button type="button" class="btn-secundario btn-chico" data-quitar-maquinaria="${maquina.id}">Quitar</button>
            </div>
        </div>
    `;
}

// Repinta la lista de máquinas dentro del popup tras agregar, quitar o cambiar el estado de una.
export function renderListaMaquinariaModal(maquinaria) {
    const contenedor = document.getElementById("modalListaMaquinaria");
    if (!contenedor) return;

    contenedor.innerHTML = maquinaria.length
        ? maquinaria.map(crearMaquinaCardEditable).join("")
        : "<p class=\"maquina-vacio\">Todavía no hay máquinas registradas en esta instalación.</p>";
}

export function abrirModal() {
    document.getElementById("formModal").classList.remove("oculto");
}

export function cerrarModal() {
    document.getElementById("formModal").classList.add("oculto");
    document.getElementById("formAlta").reset();
}

export function mostrarAccesoNoAutorizado() {
    document.body.innerHTML = `
        <main class="admin-main">
            <section class="module-header">
                <h2>Acceso no autorizado</h2>
                <p>Tenés que iniciar sesión para entrar al panel administrador.</p>
                <a href="../frontend-usuarios/login.html" class="btn-principal">Ir a iniciar sesión</a>
            </section>
        </main>
    `;
}
