// Punto 27 de la Fase 4: Popup de detalle de un registro -- mismo bloque que
// en el view.js original. crearMaquinaCardEditable (centrosDeAcopio/
// vertederos en modo edición) se importa de formularios.js, que es donde
// vive su definición original (compartida con renderListaMaquinariaModal).
import { crearDetalleItem, escapeHtml, claseEstado, formatearFechaHora } from "./helpers.js";
import { crearMaquinaCardEditable } from "./formularios.js";

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
