// CONTROLADOR: escucha clicks/submits del panel, pide datos al Modelo y actualiza la Vista.
// También guarda el estado propio de la pantalla (módulo abierto, registro en edición).

import * as Model from "./model.js?v=20";
import * as View from "./view.js?v=21";
import * as NotificacionesUI from "./notificaciones-ui.js?v=2";
import * as CuentaUI from "./cuenta-ui.js?v=3";
import * as ExportarExcel from "./exportar-excel.js?v=1";
import * as AsignarUI from "./asignar-ui.js?v=1";

let moduloActual = "resumen";
let idEnEdicion = null;

// Notificaciones

// Ids ya vistos en esta pestaña, para distinguir notificaciones nuevas de las ya conocidas.
let notificacionesConocidas = new Set();

function actualizarNotificaciones() {
    const notificaciones = Model.obtenerNotificacionesAdmin();
    const nuevas = notificaciones.filter((n) => !notificacionesConocidas.has(n.id));

    if (nuevas.length && notificacionesConocidas.size > 0) {
        NotificacionesUI.mostrarBanner(
            nuevas.length === 1 ? nuevas[0].mensaje : `Tenés ${nuevas.length} notificaciones nuevas.`
        );
    }

    notificacionesConocidas = new Set(notificaciones.map((n) => n.id));

    const contenedor = document.getElementById("notificacionesContenedor");
    if (contenedor) {
        NotificacionesUI.renderCampanita(
            contenedor,
            notificaciones,
            (leidas) => Model.marcarNotificacionesLeidas(leidas),
            manejarClickNotificacion
        );
    }
}

// Al tocar una notificación de incidencia nueva, abre esa incidencia en el módulo Incidencias.
async function manejarClickNotificacion(notificacion) {
    Model.marcarNotificacionesLeidas([notificacion]);

    if (notificacion.tipo === "incidencia_nueva" && notificacion.entidadId) {
        await cambiarModulo("incidencias");
        await mostrarDetalle(notificacion.entidadId);
    }

    actualizarNotificaciones();
}

// Mi cuenta (cualquier rol puede cambiar su correo, contraseña y teléfono)

async function alGuardarCuenta(cambios) {
    const resultado = await Model.actualizarCuentaPropia(cambios);

    if (resultado && resultado !== "CONTRASENA_INCORRECTA" && resultado !== "EMAIL_DUPLICADO" && resultado.cambioSesion) {
        alert("Tu correo o tu contraseña cambiaron: iniciá sesión de nuevo.");
        sessionStorage.removeItem("sigeru_sesion_v1");
        window.location.href = "../sigeru-frontend-usuarios/login.html";
    }

    return resultado;
}

async function iniciarCuenta() {
    const perfil = await Model.obtenerPerfilPropio();
    const contenedor = document.getElementById("cuentaContenedor");
    if (perfil && contenedor) {
        CuentaUI.renderMenuCuenta(contenedor, perfil, alGuardarCuenta);
    }
}

async function cambiarModulo(nombreModulo) {
    moduloActual = nombreModulo;

    document.querySelectorAll(".admin-menu-link").forEach((boton) => {
        boton.classList.toggle("active", boton.dataset.module === nombreModulo);
    });

    const config = Model.configuracionModulos[nombreModulo];
    View.actualizarEncabezadoModulo(config);

    View.limpiarBusqueda();
    actualizarControlesModulo();
    View.actualizarLayoutModulo(nombreModulo === "resumen");

    if (nombreModulo === "resumen") {
        await mostrarResumen();
    } else {
        await mostrarModulo();
    }
}

function actualizarControlesModulo() {
    const config = Model.configuracionModulos[moduloActual];
    View.actualizarFiltroEstados(config.estados);
    View.mostrarHerramientasModulo(moduloActual === "resumen");

    // Cuadrillas no tiene alta genérica: se crea vacía y se completa desde su detalle.
    const configAlta = moduloActual === "cuadrillas"
        ? { titulo: "Nueva cuadrilla" }
        : Model.formulariosAlta[moduloActual];

    View.actualizarBotonNuevo(configAlta);

    // Exportar solo se muestra en los módulos con columnasExport configurado.
    View.actualizarBotonExportar(Boolean(Model.obtenerColumnasExport(moduloActual)));

    // Filtros adicionales del módulo (y fecha en Incidencias); se reconstruyen y reenganchan cada vez.
    View.renderFiltrosExtra(Model.obtenerFiltrosExtra(moduloActual), Boolean(config.filtroFecha));
    engancharFiltrosExtra();
}

function engancharFiltrosExtra() {
    document.querySelectorAll("#filtrosExtra [data-campo-filtro]").forEach((select) => {
        select.addEventListener("change", mostrarModulo);
    });

    const fechaInput = document.getElementById("dateFilter");
    if (fechaInput) fechaInput.addEventListener("change", mostrarModulo);
}

// Carga los módulos de los que depende el resumen y pinta las tarjetas.
async function mostrarResumen() {
    const [contenedores, camiones] = await Promise.all([
        Model.obtenerRegistros("contenedores"),
        Model.obtenerRegistros("camiones"),
        Model.obtenerRegistros("incidencias"),
        Model.obtenerRegistros("funcionarios")
    ]);
    const solicitudes = await Model.obtenerSolicitudesPendientes();

    View.mostrarTarjetasResumen({
        incidenciasAbiertas: Model.contarIncidenciasAbiertas(),
        totalContenedores: contenedores.length,
        totalCamiones: camiones.length,
        funcionariosActivos: Model.contarFuncionariosActivos(),
        solicitudesPendientes: solicitudes.length
    });

    View.mostrarMensajeListaInicial();
    View.renderUltimasIncidencias(Model.obtenerUltimasIncidencias(5));
}

// Lee del DOM los filtros del módulo actual (buscador, estado, filtros extra y fecha).
// Compartido con manejarExportar() para que exporte exactamente lo que se ve en pantalla.
function leerFiltrosActuales() {
    const textoBusqueda = document.getElementById("searchInput").value;
    const estadoSeleccionado = document.getElementById("stateFilter").value;

    const filtrosExtraValores = {};
    document.querySelectorAll("#filtrosExtra [data-campo-filtro]").forEach((select) => {
        filtrosExtraValores[select.dataset.campoFiltro] = select.value;
    });

    const fechaInput = document.getElementById("dateFilter");
    const fechaSeleccionada = fechaInput ? fechaInput.value : "";

    return { textoBusqueda, estadoSeleccionado, filtrosExtraValores, fechaSeleccionada };
}

// Asegura que la caché del módulo esté cargada y devuelve los registros ya filtrados.
async function registrosDelModuloActual() {
    const { textoBusqueda, estadoSeleccionado, filtrosExtraValores, fechaSeleccionada } = leerFiltrosActuales();
    await Model.obtenerRegistros(moduloActual);
    return Model.filtrarRegistros(moduloActual, textoBusqueda, estadoSeleccionado, filtrosExtraValores, fechaSeleccionada);
}

async function mostrarModulo() {
    View.ocultarTarjetasResumen();
    View.cerrarDetailModal();

    const registros = await registrosDelModuloActual();
    const lista = View.renderListaRegistros(moduloActual, registros);

    lista.querySelectorAll(".data-row").forEach((fila) => {
        fila.addEventListener("click", () => {
            mostrarDetalle(fila.dataset.id);
        });
    });

    // Botón "Asignar" al lado de cada fila; stopPropagation para no disparar también el click de la fila.
    lista.querySelectorAll("[data-asignar-fila]").forEach((boton) => {
        boton.addEventListener("click", (evento) => {
            evento.stopPropagation();
            const id = boton.dataset.asignarFila;

            if (moduloActual === "incidencias") manejarAsignarCuadrillaAIncidencia(id);
            else if (moduloActual === "camiones") manejarAsignarChoferCamion(id);
            else if (moduloActual === "cuadrillas") manejarAsignarRutaCuadrilla(id);
        });
    });

    // "Cambiar estado" al lado de "Asignar" en Incidencias.
    lista.querySelectorAll("[data-cambiar-estado-fila]").forEach((boton) => {
        boton.addEventListener("click", (evento) => {
            evento.stopPropagation();
            manejarCambiarEstadoIncidencia(boton.dataset.cambiarEstadoFila);
        });
    });
}

// Asignación rápida (botones Asignar/Cambiar estado) para no tener que abrir el detalle.

async function manejarAsignarCuadrillaAIncidencia(id) {
    const incidencia = Model.obtenerRegistroPorId("incidencias", id);
    if (!incidencia) return;

    const nuevaCuadrilla = await AsignarUI.pedirSeleccion(
        `Asignar cuadrilla — ${incidencia.id}`,
        "Cuadrilla",
        Model.opcionesCuadrillaParaAsignar(),
        incidencia.cuadrillaId || ""
    );

    if (nuevaCuadrilla === null) return;

    await Model.asignarCuadrillaAIncidencia(id, nuevaCuadrilla);
    await mostrarModulo();
}

async function manejarCambiarEstadoIncidencia(id) {
    const incidencia = Model.obtenerRegistroPorId("incidencias", id);
    if (!incidencia) return;

    const opcionesEstado = Model.configuracionModulos.incidencias.estados.map((estado) => ({ value: estado, label: estado }));

    const nuevoEstado = await AsignarUI.pedirSeleccion(
        `Cambiar estado — ${incidencia.id}`,
        "Estado",
        opcionesEstado,
        incidencia.estado
    );

    if (nuevoEstado === null) return;

    if (nuevoEstado === "resuelta") {
        const detalle = await AsignarUI.pedirTexto(
            `Cambiar estado — ${incidencia.id}`,
            "Qué se hizo para resolverla",
            { placeholder: "Contá brevemente qué se hizo para resolver esta incidencia", requerido: true }
        );

        if (detalle === null) return;

        await Model.cambiarEstadoIncidencia(id, "resuelta", detalle);
    } else {
        await Model.cambiarEstadoIncidencia(id, nuevoEstado);
    }

    await mostrarModulo();
}

async function manejarAsignarChoferCamion(id) {
    const camion = Model.obtenerRegistroPorId("camiones", id);
    if (!camion) return;

    const nuevoChofer = await AsignarUI.pedirSeleccion(
        `Asignar chofer — ${camion.marca} ${camion.modelo}`,
        "Chofer",
        Model.opcionesChoferParaCamion(),
        camion.choferId || ""
    );

    if (nuevoChofer === null) return;

    await Model.asignarChoferACamion(id, nuevoChofer);
    await mostrarModulo();
}

async function manejarAsignarRutaCuadrilla(id) {
    const cuadrilla = Model.obtenerCuadrillaPorId(id);
    if (!cuadrilla) return;

    const nuevaRuta = await AsignarUI.pedirSeleccion(
        `Asignar ruta — ${id}`,
        "Ruta",
        Model.opcionesRutasParaAsignar(),
        cuadrilla.rutaId || ""
    );

    if (nuevaRuta === null) return;

    await Model.asignarRutaACuadrilla(id, nuevaRuta);
    await mostrarModulo();
}

// Exporta a Excel exactamente lo que se está viendo en el listado (mismos filtros que mostrarModulo).
async function manejarExportar() {
    const registros = await registrosDelModuloActual();
    const datosExport = Model.filasParaExportar(moduloActual, registros);
    if (!datosExport) return;

    const fecha = new Date().toISOString().slice(0, 10);
    const nombreModulo = moduloActual.charAt(0).toUpperCase() + moduloActual.slice(1);
    ExportarExcel.exportarExcel(`SiGeRU_${nombreModulo}_${fecha}.xlsx`, datosExport.encabezados, datosExport.filas);
}

// Ficha de Cuadrillas, de solo lectura; "Editar" abre el formulario en el mismo popup.
async function mostrarDetalleCuadrilla(id) {
    const detalle = Model.detalleCuadrilla(id);
    if (!detalle) return;

    const datosExtra = { cuadrillaRaw: Model.obtenerCuadrillaPorId(id) };
    const contenedor = View.renderDetalle("cuadrillas", detalle, datosExtra);
    View.abrirDetailModal();

    contenedor.querySelector("[data-editar-cuadrilla]").addEventListener("click", () => {
        abrirFormularioEdicionCuadrilla(id);
    });

    contenedor.querySelector("[data-baja-cuadrilla]").addEventListener("click", async () => {
        await Model.alternarBaja("cuadrillas", id);
        await mostrarModulo();
        await mostrarDetalleCuadrilla(id);
    });
}

// Datos adicionales que necesita la ficha de un registro (maquinaria, chofer asignado, cuadrilla de ruta).
function calcularDatosExtra(id, registro) {
    const esInstalacion = moduloActual === "centrosDeAcopio" || moduloActual === "vertederos";
    if (esInstalacion) {
        return { maquinaria: Model.obtenerMaquinariaDeInstalacion(id) };
    }
    if (moduloActual === "camiones") {
        return {
            choferAsignado: Model.nombreFuncionario(registro.choferId),
            cuadrilla: registro.choferId ? Model.obtenerCuadrillaDeChofer(registro.choferId) : null
        };
    }
    if (moduloActual === "rutas") {
        return { cuadrilla: Model.obtenerCuadrillaDeRuta(id) };
    }
    return {};
}

async function mostrarDetalle(id) {
    if (moduloActual === "cuadrillas") {
        await mostrarDetalleCuadrilla(id);
        return;
    }

    const registro = Model.obtenerRegistroPorId(moduloActual, id);
    if (!registro) return;

    const datosExtra = calcularDatosExtra(id, registro);
    const detalle = View.renderDetalle(moduloActual, registro, datosExtra);
    View.abrirDetailModal();

    if (moduloActual === "solicitudes") {
        const botonAprobar = detalle.querySelector("[data-aprobar-solicitud]");
        botonAprobar.addEventListener("click", async () => {
            const rol = document.getElementById(`solicitudRol-${id}`).value;

            await Model.aprobarSolicitud(id, rol);
            await mostrarModulo();
        });

        const botonRechazar = detalle.querySelector("[data-rechazar-solicitud]");
        botonRechazar.addEventListener("click", async () => {
            await Model.rechazarSolicitud(id);
            await mostrarModulo();
        });

        return;
    }

    const botonEditar = detalle.querySelector("[data-editar]");
    if (botonEditar) {
        botonEditar.addEventListener("click", () => {
            abrirFormularioEdicion(botonEditar.dataset.editar);
        });
    }

    const botonAsignarIncidencia = detalle.querySelector("[data-asignar-incidencia]");
    if (botonAsignarIncidencia) {
        botonAsignarIncidencia.addEventListener("click", () => {
            manejarAsignarCuadrillaAIncidencia(botonAsignarIncidencia.dataset.asignarIncidencia);
        });
    }

    const botonCambiarEstadoIncidencia = detalle.querySelector("[data-cambiar-estado-incidencia]");
    if (botonCambiarEstadoIncidencia) {
        botonCambiarEstadoIncidencia.addEventListener("click", () => {
            manejarCambiarEstadoIncidencia(botonCambiarEstadoIncidencia.dataset.cambiarEstadoIncidencia);
        });
    }

    const botonAccion = detalle.querySelector("[data-accion]");
    if (botonAccion) {
        botonAccion.addEventListener("click", async () => {
            const actualizado = await Model.alternarBaja(moduloActual, botonAccion.dataset.id);

            if (actualizado === "RUTA_ASIGNADA") {
                alert("Este camión tiene una ruta de recolección asignada. Quitale la ruta desde Cuadrillas antes de darlo de baja.");
                return;
            }

            if (!actualizado) return;

            await mostrarModulo();
            await mostrarDetalle(actualizado.id);
        });
    }
}

// Alta de registros nuevos (usa el modal genérico #formModal).

function abrirFormularioAlta() {
    // Cuadrillas usa un formulario propio (jefe/chofer/camión y varios operarios de una);
    // la ruta se asigna después, desde el detalle ya creado.
    if (moduloActual === "cuadrillas") {
        View.renderFormularioAltaCuadrilla({
            jefes: Model.obtenerJefesDisponibles(),
            choferes: Model.obtenerChoferesDisponibles(),
            rutas: Model.obtenerRutas(),
            operarios: Model.obtenerOperariosDisponibles()
        });
        View.abrirModal();
        activarBuscadoresCuadrilla();
        return;
    }

    const config = Model.obtenerConfigAlta(moduloActual);
    if (!config) return;

    View.renderCamposFormulario(config, "alta");
    View.abrirModal();
}

// Buscador por nombre/cédula en los selects de Jefe/Chofer y el checklist de Operarios.
// El selector apunta solo a las opciones con data-busqueda, así "Sin asignar" nunca se oculta.
function activarBuscadoresCuadrilla() {
    View.activarBuscador("buscarCuadrillaJefe", "#campoCuadrillaJefe option[data-busqueda]");
    View.activarBuscador("buscarCuadrillaChofer", "#campoCuadrillaChofer option[data-busqueda]");
    View.activarBuscador("buscarCuadrillaOperarios", ".checkbox-operario");
}

async function manejarFormularioSubmit(evento) {
    evento.preventDefault();

    // Alta de cuadrilla: se crea vacía y se le aplican las mismas funciones de asignación que su detalle.
    if (moduloActual === "cuadrillas") {
        const formulario = evento.target;
        const jefeId = formulario.elements["jefeId"].value || null;
        const choferId = formulario.elements["choferId"].value || null;
        const rutaId = formulario.elements["rutaId"].value || null;
        const operariosSeleccionados = Array.from(
            formulario.querySelectorAll('input[name="operarios"]:checked')
        ).map((input) => input.value);

        View.cerrarModal();

        const nueva = await Model.crearCuadrilla();
        if (jefeId) await Model.asignarJefeACuadrilla(nueva.id, jefeId);
        if (choferId) await Model.asignarChoferACuadrilla(nueva.id, choferId);
        if (rutaId) await Model.asignarRutaACuadrilla(nueva.id, rutaId);

        // for...of (no forEach) para esperar cada asignación de operario en orden.
        for (const operarioId of operariosSeleccionados) {
            await Model.moverOperario(operarioId, nueva.id);
        }

        await mostrarModulo();
        await mostrarDetalleCuadrilla(nueva.id);
        return;
    }

    const config = Model.obtenerConfigAlta(moduloActual);
    if (!config) return;

    const formulario = evento.target;
    const valoresCampos = {};

    config.campos.forEach((campo) => {
        valoresCampos[campo.nombre] = formulario.elements[campo.nombre].value;
    });

    const resultado = await Model.crearRegistro(moduloActual, valoresCampos);

    // Correo ya usado por otra cuenta; se deja el modal abierto para reintentar.
    if (resultado === "EMAIL_DUPLICADO") {
        alert("Ya existe una cuenta con ese correo electrónico. Usá otro correo para este funcionario.");
        return;
    }

    // Cédula ya registrada por otra cuenta.
    if (resultado === "CEDULA_DUPLICADA") {
        alert("Ya existe una cuenta con esa cédula.");
        return;
    }

    View.cerrarModal();
    await mostrarModulo();
}

// Edición de un registro existente: "Editar" transforma el popup de detalle en un formulario in place.

function abrirFormularioEdicion(id) {
    const config = Model.obtenerConfigEdicion(moduloActual);
    const registro = Model.obtenerRegistroPorId(moduloActual, id);
    if (!config || !registro) return;

    idEnEdicion = id;

    const datosExtra = calcularDatosExtra(id, registro);
    View.renderDetalle(moduloActual, registro, datosExtra, config);

    document.getElementById("detailEditForm").addEventListener("submit", manejarEdicionEnDetalleSubmit);
    document.getElementById("detailEditCancelar").addEventListener("click", () => mostrarDetalle(id));

    // Centros de acopio y vertederos gestionan su maquinaria dentro de la misma ficha en edición.
    if (moduloActual === "centrosDeAcopio" || moduloActual === "vertederos") {
        const refrescarMaquinaria = () => {
            View.renderListaMaquinariaModal(Model.obtenerMaquinariaDeInstalacion(id));
        };

        const listaMaquinaria = document.getElementById("modalListaMaquinaria");
        listaMaquinaria.addEventListener("change", async (evento) => {
            const idMaquinaria = evento.target.dataset.cambiarEstadoMaquinaria;
            if (!idMaquinaria) return;

            await Model.cambiarEstadoMaquinaria(idMaquinaria, evento.target.value);
            refrescarMaquinaria();
        });

        listaMaquinaria.addEventListener("click", async (evento) => {
            const idMaquinaria = evento.target.dataset.quitarMaquinaria;
            if (!idMaquinaria) return;

            await Model.quitarMaquinaria(idMaquinaria);
            refrescarMaquinaria();
        });

        document.getElementById("modalAgregarMaquinaria").addEventListener("click", async () => {
            const input = document.getElementById("modalNuevaMaquinariaTipo");
            const tipo = input.value.trim();
            if (!tipo) return;

            await Model.agregarMaquinaria(id, tipo);
            input.value = "";
            refrescarMaquinaria();
        });
    }
}

async function manejarEdicionEnDetalleSubmit(evento) {
    evento.preventDefault();

    const config = Model.obtenerConfigEdicion(moduloActual);
    if (!config) return;

    const formulario = evento.target;
    const valoresCampos = {};

    config.campos.forEach((campo) => {
        valoresCampos[campo.nombre] = formulario.elements[campo.nombre].value;
    });

    await Model.editarRegistro(moduloActual, idEnEdicion, valoresCampos);
    await mostrarModulo();
    View.cerrarDetailModal();
}

// Cuadrillas no usa el modal genérico: transforma el popup de detalle en su propio formulario.
function abrirFormularioEdicionCuadrilla(id) {
    const cuadrillaRaw = Model.obtenerCuadrillaPorId(id);
    if (!cuadrillaRaw) return;

    idEnEdicion = id;

    const formulario = View.renderFormularioEdicionCuadrillaEnDetalle(cuadrillaRaw, {
        jefes: Model.obtenerJefesDisponibles(),
        choferes: Model.obtenerChoferesDisponibles(),
        rutas: Model.obtenerRutas(),
        operarios: Model.obtenerOperariosDisponibles()
    });
    formulario.addEventListener("submit", manejarEdicionCuadrillaEnDetalleSubmit);
    document.getElementById("detailEditCancelar").addEventListener("click", () => mostrarDetalleCuadrilla(id));
    activarBuscadoresCuadrilla();
}

// Reconcilia el checklist de operarios: agrega los tildados de nuevo y saca los destildados.
async function manejarEdicionCuadrillaEnDetalleSubmit(evento) {
    evento.preventDefault();

    const formulario = evento.target;
    const jefeId = formulario.elements["jefeId"].value || null;
    const choferId = formulario.elements["choferId"].value || null;
    const rutaId = formulario.elements["rutaId"].value || null;
    const operariosSeleccionados = Array.from(
        formulario.querySelectorAll('input[name="operarios"]:checked')
    ).map((input) => input.value);

    const cuadrillaAntes = Model.obtenerCuadrillaPorId(idEnEdicion);
    const operariosAntes = cuadrillaAntes ? [...cuadrillaAntes.operarios] : [];

    await Model.asignarJefeACuadrilla(idEnEdicion, jefeId);
    await Model.asignarChoferACuadrilla(idEnEdicion, choferId);
    await Model.asignarRutaACuadrilla(idEnEdicion, rutaId);

    // for...of para esperar cada moverOperario en orden.
    for (const idOperario of operariosAntes) {
        if (!operariosSeleccionados.includes(idOperario)) {
            await Model.moverOperario(idOperario, null);
        }
    }

    for (const idOperario of operariosSeleccionados) {
        if (!operariosAntes.includes(idOperario)) {
            await Model.moverOperario(idOperario, idEnEdicion);
        }
    }

    await mostrarModulo();
    View.cerrarDetailModal();
}

// Eventos globales de la pantalla

function cerrarModalYRefrescar() {
    View.cerrarModal();
}

function iniciarEventos() {
    document.querySelectorAll(".admin-menu-link").forEach((boton) => {
        boton.addEventListener("click", () => {
            cambiarModulo(boton.dataset.module);
        });
    });

    document.getElementById("searchInput").addEventListener("input", mostrarModulo);
    document.getElementById("stateFilter").addEventListener("change", mostrarModulo);

    document.getElementById("newRecordBtn").addEventListener("click", abrirFormularioAlta);
    document.getElementById("formAlta").addEventListener("submit", manejarFormularioSubmit);

    document.getElementById("exportBtn").addEventListener("click", manejarExportar);

    document.querySelectorAll("#modalCerrar, #modalCancelar").forEach((boton) => {
        boton.addEventListener("click", cerrarModalYRefrescar);
    });

    document.getElementById("formModal").addEventListener("click", (evento) => {
        if (evento.target.id === "formModal") {
            cerrarModalYRefrescar();
        }
    });

    document.getElementById("detailModalCerrar").addEventListener("click", () => {
        View.cerrarDetailModal();
    });

    document.getElementById("detailModal").addEventListener("click", (evento) => {
        if (evento.target.id === "detailModal") {
            View.cerrarDetailModal();
        }
    });
}

export async function initAdmin() {
    if (Model.usuarioActual && Model.usuarioActual.rol === "administrador") {
        iniciarEventos();
        await cambiarModulo("resumen");
        actualizarNotificaciones();
        await iniciarCuenta();
    } else {
        View.mostrarAccesoNoAutorizado();
    }
}
