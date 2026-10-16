// Punto 27 de la Fase 4: Modal de alta -- mismo bloque que en el view.js
// original, incluyendo lo que venía después sin un comentario de sección
// propio (abrirModal/cerrarModal/mostrarAccesoNoAutorizado). crearOpciones
// y normalizarBusqueda se importan de helpers.js (ahí quedó su definición
// original); crearMaquinaCardEditable queda exportada (promovida, no
// privada como en el original) porque detalle-modal.js también la necesita
// (centrosDeAcopio/vertederos en modo edición).
import { escapeHtml, claseEstado, crearOpciones, normalizarBusqueda } from "./helpers.js";

// Buscador de texto para Jefe/Chofer/Operarios (ver activarBuscador() en
// view.js, enganchado desde activarBuscadoresCuadrilla() en controller.js).
// Antes esto traía además un desplegable "Todos/Libres/Ya asignados" -- se
// sacó (pedido de Matías 14/10) porque entre buscador + filtro + select/
// checklist quedaban demasiados controles para algo tan chico como elegir
// jefe/chofer/operarios; quién ya está en otra cuadrilla ahora se ve directo
// en la propia opción/checkbox (ver crearOpciones() y operarioCheckboxHtml
// más abajo) en vez de tener que filtrar para encontrarlo.
function filaBuscador(inputId) {
    return `<input type="text" id="${inputId}" class="input-buscador" placeholder="Buscar por nombre o cédula..." autocomplete="off">`;
}

// Campos compartidos por el alta y la edición de Cuadrillas.
function construirCamposCuadrillaHtml({ jefes, choferes, rutas, operarios }, cuadrillaRaw = null) {
    const textoBusquedaFuncionario = (f) => `${f.nombre} ${f.apellido} ${f.cedula || ""}`;

    // Model ya anota cada funcionario con _otraCuadrilla ({id, nombre}) cuando
    // ya pertenece a OTRA cuadrilla. Se muestra siempre, no solo al filtrar:
    // en Jefe/Chofer, crearOpciones() resalta la opción y le agrega "— cuadrilla
    // X"; en Operarios, el checkbox de abajo le agrega la misma etiqueta. A
    // propósito se usa el número de cuadrilla (_otraCuadrilla.id), nunca
    // _otraCuadrilla.nombre -- ese puede traer códigos internos feos tipo
    // "(E_DU_RM_CL_111)" que no aportan nada acá. Elegir a alguien "ya
    // asignado" sigue sin estar bloqueado: el aviso real es la confirmación
    // al guardar (ver manejarFormularioSubmit/manejarEdicionCuadrillaEnDetalleSubmit).
    const etiquetaFuncionario = (f) => `${f.nombre} ${f.apellido}`;

    const opcionesJefe = crearOpciones(jefes, cuadrillaRaw?.jefeId ?? null, etiquetaFuncionario, textoBusquedaFuncionario);
    const opcionesChofer = crearOpciones(choferes, cuadrillaRaw?.choferId ?? null, etiquetaFuncionario, textoBusquedaFuncionario);
    const opcionesRuta = crearOpciones(rutas, cuadrillaRaw?.rutaId ?? null, (r) => `${r.nombre || r.zona} — ${r.horario}`);
    const operariosDeEstaCuadrilla = cuadrillaRaw?.operarios ?? [];

    const operarioCheckboxHtml = (f) => {
        const etiquetaCuadrilla = f._otraCuadrilla
            ? `<span class="etiqueta-asignado">cuadrilla ${escapeHtml(f._otraCuadrilla.id)}</span>`
            : "";

        return `
        <label class="checkbox-operario" data-busqueda="${escapeHtml(normalizarBusqueda(textoBusquedaFuncionario(f)))}">
            <input type="checkbox" name="operarios" value="${f.id}" ${operariosDeEstaCuadrilla.includes(f.id) ? "checked" : ""}>
            ${escapeHtml(etiquetaFuncionario(f))}${etiquetaCuadrilla}
        </label>
    `;
    };

    const operariosHtml = operarios.length
        ? operarios.map(operarioCheckboxHtml).join("")
        : `<p class="detail-empty">No hay operarios disponibles.</p>`;

    // El camión no se elige acá: sigue al chofer asignado (se empareja desde el módulo Camiones).
    return `
        <div class="grupo-formulario">
            <label for="campoCuadrillaJefe">Jefe de cuadrilla</label>
            ${filaBuscador("buscarCuadrillaJefe")}
            <select id="campoCuadrillaJefe" name="jefeId">
                <option value="">Sin asignar</option>
                ${opcionesJefe}
            </select>
        </div>

        <div class="grupo-formulario">
            <label for="campoCuadrillaChofer">Chofer</label>
            ${filaBuscador("buscarCuadrillaChofer")}
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
            <label>Operarios <span class="contador-operarios" data-contador-operarios>${operariosDeEstaCuadrilla.length}/3</span></label>
            ${filaBuscador("buscarCuadrillaOperarios")}
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

// "Nueva ruta" (14/10/2026): a diferencia del resto de los módulos (campos
// fijos, ver formulariosAlta.rutas en model.js), el alta de una ruta pide
// además elegir un barrio y asignarle sus contenedores -- mismo patrón que
// el formulario de Cuadrillas de arriba (formulario propio en vez del
// genérico de más abajo), por eso vive acá y no en construirCamposHtml().
// Ver claude/rutas_por_contenedor_09_10_2026.md para el contexto completo.
//
// Ajuste 14/10/2026 (2da vuelta): el orden de recolección ya NO se le
// muestra a quien arma la ruta -- a esa persona solo le interesa elegir
// barrio y contenedores. El orden se calcula solo (ver
// actualizarRecorridoAutocompletado/ordenParaPersistir en controller.js) y
// se guarda para que lo vea el chofer en su panel. Por eso ya no hay botón
// "Sugerir orden" ni bloque de lista numerada acá.
function construirCamposRutaHtml({ barrios }) {
    const opcionesBarrio = barrios.map((barrio) => `<option value="${escapeHtml(barrio)}">${escapeHtml(barrio)}</option>`).join("");

    return `
        <div class="grupo-formulario grupo-formulario-completo">
            <label for="campoRutaNombre">Nombre de la ruta</label>
            <input type="text" id="campoRutaNombre" name="nombre" placeholder="Ej: Pocitos 9 (si el barrio ya tiene otras rutas, para distinguirla)">
        </div>

        <div class="grupo-formulario">
            <label for="campoRutaBarrio">Barrio</label>
            <select id="campoRutaBarrio" name="zona" required>
                <option value="">Elegí un barrio...</option>
                ${opcionesBarrio}
            </select>
        </div>

        <div class="grupo-formulario">
            <label for="campoRutaMunicipio">Municipio</label>
            <input type="text" id="campoRutaMunicipio" name="municipio" placeholder="Se completa solo al elegir el barrio" disabled>
        </div>

        <div class="grupo-formulario grupo-formulario-completo">
            <label for="campoRutaRecorrido">Recorrido</label>
            <input type="text" id="campoRutaRecorrido" name="recorrido" placeholder="Ej: Av. Brasil - Bulevar España - Rambla" required>
        </div>

        <div class="grupo-formulario">
            <label for="campoRutaFrecuencia">Frecuencia</label>
            <select id="campoRutaFrecuencia" name="frecuencia" required>
                <option value="Diaria">Diaria</option>
                <option value="Interdiaria">Interdiaria</option>
                <option value="Semanal">Semanal</option>
                <option value="Irregular">Irregular</option>
                <option value="Sin datos">Sin datos</option>
            </select>
        </div>

        <div class="grupo-formulario">
            <label for="campoRutaHorario">Horario</label>
            <input type="text" id="campoRutaHorario" name="horario" placeholder="Ej: 08:00 a 14:00" required>
        </div>

        <div class="grupo-formulario grupo-formulario-completo">
            <label>
                Contenedores de esta ruta
                <span class="contador-operarios" id="contadorContenedoresRuta"></span>
            </label>

            <div id="zonaRutaSinElegir" class="detail-empty" style="margin-top:6px;">
                Elegí un barrio para ver sus contenedores.
            </div>

            <div id="bloqueContenedoresRuta" style="display:none;">
                <input type="text" id="buscarContenedoresRuta" class="input-buscador" placeholder="Buscar por dirección..." autocomplete="off">
                <div class="lista-checkbox-operarios lista-checkbox-operarios--grande" id="listaContenedoresRuta"></div>
                <p id="avisoMinimoRuta" class="detail-nota" style="margin-top:6px;"></p>
            </div>
        </div>
    `;
}

// Arma el modal de alta de ruta (barrio + municipio autocompletado + checklist de contenedores).
export function renderFormularioAltaRuta(datos) {
    document.getElementById("modalTitulo").textContent = "Nueva ruta";
    document.getElementById("modalFormFields").innerHTML = construirCamposRutaHtml(datos);
}

// Pinta el checklist de contenedores de UN barrio (al elegirlo en "Nueva
// ruta", ver activarFormularioRuta() en controller.js). Mismo patrón que
// operarioCheckboxHtml de arriba: quien ya está en OTRA ruta se ve con una
// etiqueta al lado de la dirección (Model.obtenerContenedoresDeBarrio ya
// anota cada contenedor con _otraRuta), en vez de bloquear la opción --
// elegirlo igual está permitido, se lo reasigna a la ruta nueva al guardar.
export function renderContenedoresRuta(contenedores) {
    const lista = document.getElementById("listaContenedoresRuta");
    if (!lista) return;

    lista.innerHTML = contenedores.length
        ? contenedores.map((c) => {
            const etiqueta = c._otraRuta
                ? `<span class="etiqueta-asignado">${escapeHtml(c._otraRuta.nombre)}</span>`
                : "";

            return `
                <label class="checkbox-operario" data-busqueda="${escapeHtml(normalizarBusqueda(c.ubicacionContenedor || ""))}">
                    <input type="checkbox" name="contenedores" value="${c.idContenedor}">
                    ${escapeHtml(c.ubicacionContenedor || "(sin dirección)")}${etiqueta}
                </label>
            `;
        }).join("")
        : `<p class="detail-empty">Este barrio no tiene contenedores cargados.</p>`;
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
export function crearMaquinaCardEditable(maquina) {
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
