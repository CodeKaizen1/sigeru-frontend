// CONTROLADOR: escucha clicks/submits del panel, pide datos al Modelo y actualiza la Vista.
// También guarda el estado propio de la pantalla (módulo abierto, registro en edición).

import * as Model from "./model.js?v=36";
import * as View from "./view.js?v=39";
import * as NotificacionesUI from "./notificaciones-ui.js?v=2";
import * as CuentaUI from "./cuenta-ui.js?v=4";
import * as ExportarExcel from "./exportar-excel.js?v=1";
import * as AsignarUI from "./asignar-ui.js?v=1";
import * as ConfirmarUI from "./confirmar-ui.js?v=3";

let moduloActual = "resumen";
let idEnEdicion = null;

// Paginado del listado (controller.js arma la página, View.renderListaRegistros
// solo pinta lo que le llega). Necesario desde que se cargaron los ~11.130
// contenedores oficiales de la IMM: antes renderListaRegistros() pintaba
// TODO el listado filtrado de una, y con esa cantidad de filas el panel se
// congelaba. Elegible por el usuario (#pageSizeSelect, 10/25/50) para no
// imponer un único tamaño de página en listados grandes; arranca en 10.
let registrosPorPagina = 10;
let paginaActual = 1;

// Punto 9 de la Fase 2 (auditoría 08/10/2026): escribir en el buscador
// refiltraba los ~11.130 contenedores en cada tecla. Mismo patrón de
// debounce() que ya usa landing/js/app.js para su buscador.
const ESPERA_BUSQUEDA_MS = 300;

function debounce(funcion, esperaMs) {
    let temporizador = null;
    return (...args) => {
        clearTimeout(temporizador);
        temporizador = setTimeout(() => funcion(...args), esperaMs);
    };
}

// Notificaciones

// Ids ya vistos en esta pestaña, para distinguir notificaciones nuevas de las ya conocidas.
let notificacionesConocidas = new Set();

async function actualizarNotificaciones() {
    const notificaciones = await Model.obtenerNotificacionesAdmin();
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

    await actualizarNotificaciones();
}

// Mi cuenta (cualquier rol puede cambiar su correo, contraseña y teléfono)

async function alGuardarCuenta(cambios) {
    const resultado = await Model.actualizarCuentaPropia(cambios);

    if (resultado && resultado !== "CONTRASENA_INCORRECTA" && resultado !== "EMAIL_DUPLICADO" && resultado !== "CONTRASENA_DEBIL" && resultado.cambioSesion) {
        alert("Tu correo o tu contraseña cambiaron: iniciá sesión de nuevo.");
        sessionStorage.removeItem("sigeru_sesion_v1");
        window.location.href = "../frontend-usuarios/login.html";
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
    paginaActual = 1;

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
    } else if (nombreModulo === "informes") {
        filtrosInforme = { desde: "", hasta: "", zona: "", tipo: "" };
        await mostrarInformes();
    } else {
        await mostrarModulo();
    }

    // Sin un backend de notificaciones con polling/websockets, navegar entre
    // módulos es el momento más natural para refrescar la campanita (punto 16).
    await actualizarNotificaciones();
}

function actualizarControlesModulo() {
    const config = Model.configuracionModulos[moduloActual];
    View.actualizarFiltroEstados(config.estados);
    View.mostrarHerramientasModulo(moduloActual === "resumen" || moduloActual === "informes");

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
        select.addEventListener("change", mostrarModuloDesdeFiltro);
    });

    const fechaInput = document.getElementById("dateFilter");
    if (fechaInput) fechaInput.addEventListener("change", mostrarModuloDesdeFiltro);
}

// Cualquier cambio de filtro (búsqueda, estado, filtros extra, fecha) vuelve
// a la página 1 -- si no, un cambio de filtro podía dejar "paginaActual" en
// una página que ya no existe para el nuevo resultado filtrado.
function mostrarModuloDesdeFiltro() {
    paginaActual = 1;
    mostrarModulo();
}

// Versión debounced de arriba, solo para el input de texto (ver searchInput
// más abajo) -- estado/filtros extra/fecha siguen llamando a la de arriba
// directo porque son "change", no "input": no disparan por cada tecla.
const mostrarModuloDesdeFiltroDebounced = debounce(mostrarModuloDesdeFiltro, ESPERA_BUSQUEDA_MS);

// Carga los módulos de los que depende el resumen y pinta las tarjetas + gráficos.
async function mostrarResumen() {
    const [contenedores, camiones] = await Promise.all([
        Model.obtenerRegistros("contenedores"),
        Model.obtenerRegistros("camiones"),
        Model.obtenerRegistros("incidencias"),
        Model.obtenerRegistros("funcionarios"),
        Model.obtenerRegistros("rutas")
    ]);
    const solicitudes = await Model.obtenerSolicitudesPendientes();

    View.mostrarTarjetasResumen({
        incidenciasAbiertas: Model.contarIncidenciasAbiertas(),
        totalContenedores: contenedores.length,
        totalCamiones: camiones.length,
        funcionariosActivos: Model.contarFuncionariosActivos(),
        solicitudesPendientes: solicitudes.length
    });

    View.renderGraficosResumen({
        incidenciasPorEstado: Model.distribucionIncidenciasPorEstado(),
        incidenciasPorTipo: Model.distribucionIncidenciasPorTipo(),
        contenedoresPorEstado: Model.distribucionContenedoresPorEstado(),
        rutasPorFrecuencia: Model.distribucionRutasPorFrecuencia()
    });

    View.renderUltimasIncidencias(Model.obtenerUltimasIncidencias(5));
}

// Informe de incidencias (Fase 4, punto 15). Filtros propios (no los de
// #moduleTools, que están ocultos acá) -- se guardan en este módulo para
// sobrevivir a los reenganches cada vez que cambia un filtro.
let filtrosInforme = { desde: "", hasta: "", zona: "", tipo: "" };

async function mostrarInformes() {
    await Model.obtenerRegistros("informes");

    const informe = Model.generarInformeIncidencias(filtrosInforme);

    View.renderInformeIncidencias({
        filtros: filtrosInforme,
        zonas: Model.opcionesZonaInformeIncidencias(),
        tipos: Model.opcionesTipoInformeIncidencias(),
        informe
    });

    engancharControlesInforme();
}

function engancharControlesInforme() {
    const contenedor = document.getElementById("moduleList");

    contenedor.querySelector("[data-informe-desde]").addEventListener("change", (evento) => {
        filtrosInforme.desde = evento.target.value;
        mostrarInformes();
    });

    contenedor.querySelector("[data-informe-hasta]").addEventListener("change", (evento) => {
        filtrosInforme.hasta = evento.target.value;
        mostrarInformes();
    });

    contenedor.querySelector("[data-informe-zona]").addEventListener("change", (evento) => {
        filtrosInforme.zona = evento.target.value;
        mostrarInformes();
    });

    contenedor.querySelector("[data-informe-tipo]").addEventListener("change", (evento) => {
        filtrosInforme.tipo = evento.target.value;
        mostrarInformes();
    });

    contenedor.querySelector("[data-informe-limpiar]").addEventListener("click", () => {
        filtrosInforme = { desde: "", hasta: "", zona: "", tipo: "" };
        mostrarInformes();
    });

    contenedor.querySelector("[data-informe-exportar]").addEventListener("click", () => {
        const informe = Model.generarInformeIncidencias(filtrosInforme);
        const { encabezados, filas } = Model.filasInformeIncidenciasParaExportar(informe.filas);
        const fecha = new Date().toISOString().slice(0, 10);
        ExportarExcel.exportarExcel(`SiGeRU_Informe_Incidencias_${fecha}.xlsx`, encabezados, filas);
    });
}

// Lee del DOM los filtros del módulo actual (buscador, estado, filtros extra y fecha).
// Compartido con manejarExportar(), que exporta TODO lo que matchea los
// filtros (no solo la página actual que se ve en pantalla -- eso sería una
// sorpresa rara al exportar con 11 mil contenedores filtrados).
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

    const registrosFiltrados = await registrosDelModuloActual();

    const totalPaginas = Math.max(1, Math.ceil(registrosFiltrados.length / registrosPorPagina));
    // Si el filtro cambió el total y paginaActual quedó apuntando a una
    // página que ya no existe (ej: estabas en la página 4 de "funcional" y
    // cambiaste a un filtro con solo 1 página), se recorta a la última válida.
    if (paginaActual > totalPaginas) paginaActual = totalPaginas;

    const inicio = (paginaActual - 1) * registrosPorPagina;
    const registros = registrosFiltrados.slice(inicio, inicio + registrosPorPagina);

    const lista = View.renderListaRegistros(moduloActual, registros);
    const paginador = View.renderPaginador(paginaActual, totalPaginas);

    if (paginador) {
        const botonAnterior = paginador.querySelector("[data-pagina-anterior]");
        const botonSiguiente = paginador.querySelector("[data-pagina-siguiente]");

        if (botonAnterior) {
            botonAnterior.addEventListener("click", () => {
                if (paginaActual > 1) {
                    paginaActual -= 1;
                    mostrarModulo();
                }
            });
        }

        if (botonSiguiente) {
            botonSiguiente.addEventListener("click", () => {
                if (paginaActual < totalPaginas) {
                    paginaActual += 1;
                    mostrarModulo();
                }
            });
        }

        // Punto 10 de la Fase 2: saltar directo a una página en vez de
        // tener que ir de a una con Anterior/Siguiente.
        const inputPagina = paginador.querySelector("[data-pagina-input]");
        if (inputPagina) {
            const irAPagina = () => {
                const destino = Math.min(Math.max(Math.trunc(Number(inputPagina.value)) || 1, 1), totalPaginas);
                if (destino !== paginaActual) {
                    paginaActual = destino;
                    mostrarModulo();
                } else {
                    inputPagina.value = paginaActual;
                }
            };

            inputPagina.addEventListener("keydown", (evento) => {
                if (evento.key === "Enter") {
                    evento.preventDefault();
                    irAPagina();
                }
            });
            inputPagina.addEventListener("blur", irAPagina);
        }
    }

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
        Model.opcionesCuadrillaParaAsignar(incidencia.zona),
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

// Confirmaciones antes de asignar un chofer/jefe/operario que ya está en otro
// lado -- antes se reasignaba en silencio (se lo sacaba de donde estaba sin
// avisar). Devuelven false si había un conflicto y el usuario lo canceló, caso
// en el que el caller no debe seguir con el guardado.

async function confirmarChoferDeCamion(cedulaChofer, idCamionExcluir) {
    if (!cedulaChofer) return true;
    const otroCamion = Model.obtenerOtroCamionDeChofer(cedulaChofer, idCamionExcluir);
    if (!otroCamion) return true;

    const nombre = Model.nombreFuncionario(cedulaChofer) || "Este chofer";
    return ConfirmarUI.confirmar(
        `${nombre} ya tiene asignado el camión ${otroCamion.matricula || otroCamion.id} (estado: ${otroCamion.estado || "sin datos"}). ¿Desea reasignarlo a este camión?`
    );
}

async function confirmarJefeOChoferDeCuadrilla(tipo, cedula, idCuadrillaExcluir) {
    if (!cedula) return true;
    const otra = tipo === "jefe"
        ? Model.obtenerOtraCuadrillaDeJefe(cedula, idCuadrillaExcluir)
        : Model.obtenerOtraCuadrillaDeChofer(cedula, idCuadrillaExcluir);
    if (!otra) return true;

    const nombre = Model.nombreFuncionario(cedula) || "Esta persona";
    const etiqueta = tipo === "jefe" ? "jefe" : "chofer";
    return ConfirmarUI.confirmar(`${nombre} ya es ${etiqueta} de la cuadrilla "${otra.nombre}". ¿Desea reasignarlo a esta cuadrilla?`);
}

async function confirmarOperarioDeCuadrilla(cedula, idCuadrillaExcluir) {
    const otra = Model.obtenerOtraCuadrillaDeOperario(cedula, idCuadrillaExcluir);
    if (!otra) return true;

    const nombre = Model.nombreFuncionario(cedula) || "Esta persona";
    return ConfirmarUI.confirmar(`${nombre} ya es operario de la cuadrilla "${otra.nombre}". ¿Desea reasignarlo a esta cuadrilla?`);
}

async function manejarAsignarChoferCamion(id) {
    const camion = Model.obtenerRegistroPorId("camiones", id);
    if (!camion) return;

    const nuevoChofer = await AsignarUI.pedirSeleccion(
        `Asignar chofer — ${camion.marca} ${camion.modelo}`,
        "Chofer",
        Model.opcionesChoferParaCamion(id),
        camion.choferId || ""
    );

    if (nuevoChofer === null) return;
    if (!(await confirmarChoferDeCamion(nuevoChofer, id))) return;

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

    const botonRecalcularOrden = detalle.querySelector("[data-recalcular-orden]");
    if (botonRecalcularOrden) {
        botonRecalcularOrden.addEventListener("click", () => {
            manejarRecalcularOrdenRuta(botonRecalcularOrden.dataset.recalcularOrden);
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

async function abrirFormularioAlta() {
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

    // Rutas también usa un formulario propio: a diferencia del resto de los
    // módulos, "Nueva ruta" pide elegir un barrio y asignarle contenedores
    // (ver claude/rutas_por_contenedor_09_10_2026.md), no solo los campos
    // fijos de formulariosAlta.rutas.
    if (moduloActual === "rutas") {
        View.renderFormularioAltaRuta({ barrios: await Model.obtenerBarriosDisponibles() });
        View.abrirModal();
        activarFormularioRuta();
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
    activarLimiteOperarios();
}

// Una cuadrilla no puede tener más de 5 personas en total (jefe + chofer +
// hasta 3 operarios) - jefe y chofer ya son selects de uno solo, así que acá
// solo falta topear los operarios. Al llegar a 3 tildados deshabilita el
// resto del checklist para que no se pueda sumar un cuarto; no desmarca nada
// si una cuadrilla ya venía con más operarios de antes (dato viejo), solo
// impide agregar más hasta que se baje de 3.
function activarLimiteOperarios() {
    const checkboxes = Array.from(document.querySelectorAll('input[name="operarios"]'));
    const contador = document.querySelector("[data-contador-operarios]");
    if (!checkboxes.length) return;

    function actualizar() {
        const marcados = checkboxes.filter((casilla) => casilla.checked).length;
        checkboxes.forEach((casilla) => {
            casilla.disabled = !casilla.checked && marcados >= 3;
        });
        if (contador) contador.textContent = `${marcados}/3`;
    }

    checkboxes.forEach((casilla) => casilla.addEventListener("change", actualizar));
    actualizar();
}

// "Nueva ruta" (14/10/2026): elegir barrio + asignarle sus contenedores,
// con un mínimo por ruta y un orden de recolección sugerido opcional. Ver
// claude/rutas_por_contenedor_09_10_2026.md para el porqué de todo esto, y
// View.construirCamposRutaHtml (view.js) para el HTML que esto engancha.
//
// Mínimo pedido por Matías (14/10): 25 contenedores por ruta (coincide con
// el piso realista investigado en claude/investigacion_contenedores_por_ruta.md),
// pero ajustado hacia abajo si el barrio elegido no llega a esa cantidad
// (hay barrios chicos, ver Casabó-Pajas Blancas en esa misma investigación) --
// nunca deja una ruta imposible de crear.
const MINIMO_CONTENEDORES_RUTA = 25;

// Máximo pedido por Matías (14/10, 2da vuelta): "usemos el máximo que tiene
// la ruta con más contenedores". 05_rutas_por_contenedor.sql (el script que
// reparte los contenedores reales entre rutas) reparte cada barrio "en
// grupos de ~25 a 40 por ruta" a propósito -- y calculando el reparto más
// parejo posible para los 62 barrios de ese script, el caso más alto
// (Malvin Norte / Jacinto Vera) da 39 contenedores en la ruta más cargada.
// 40 redondea ese tope real hacia arriba (mismo límite superior que ya usa
// el propio script de datos).
const MAXIMO_CONTENEDORES_RUTA = 40;

// Contenedores del barrio elegido (con latitud/longitud/_otraRuta, tal cual
// los devuelve Model.obtenerContenedoresDeBarrio) -- estado propio de este
// formulario, se reinicia cada vez que se abre "Nueva ruta" o cambia el barrio.
let contenedoresDelBarrioRuta = [];

// Si el admin ya tocó el campo "Recorrido" a mano, dejamos de autocompletarlo
// (ver actualizarRecorridoAutocompletado) -- se reinicia al elegir barrio.
let recorridoEditadoManualmente = false;

function minimoContenedoresParaBarrio(total) {
    return Math.min(MINIMO_CONTENEDORES_RUTA, total);
}

function botonGuardarRuta() {
    return document.querySelector("#formAlta button[type=submit]");
}

function actualizarContadorContenedoresRuta() {
    const total = contenedoresDelBarrioRuta.length;
    const minimo = minimoContenedoresParaBarrio(total);
    const casillas = document.querySelectorAll('#listaContenedoresRuta input[name="contenedores"]');
    const marcados = Array.from(casillas).filter((input) => input.checked).length;

    document.getElementById("contadorContenedoresRuta").textContent = `${marcados}/${minimo} mínimo (máx. ${MAXIMO_CONTENEDORES_RUTA})`;

    // Al llegar al máximo, se deshabilitan las casillas no tildadas en vez de
    // dejar seguir sumando y recién avisar al guardar -- "no pueden ser
    // infinitas" (Matías, 14/10, 2da vuelta).
    casillas.forEach((input) => {
        if (!input.checked) input.disabled = marcados >= MAXIMO_CONTENEDORES_RUTA;
    });

    const aviso = document.getElementById("avisoMinimoRuta");
    const btnGuardar = botonGuardarRuta();

    if (marcados < minimo) {
        const faltan = minimo - marcados;
        aviso.textContent = total < MINIMO_CONTENEDORES_RUTA
            ? `Este barrio tiene ${total} contenedores en total — hay que asignarlos todos (mínimo ajustado porque no llega a ${MINIMO_CONTENEDORES_RUTA}). Faltan ${faltan}.`
            : `Faltan ${faltan} para llegar al mínimo de ${minimo} contenedores por ruta.`;
        aviso.style.color = "#a33";
        if (btnGuardar) btnGuardar.disabled = true;
    } else if (marcados >= MAXIMO_CONTENEDORES_RUTA) {
        aviso.textContent = `Llegaste al máximo de ${MAXIMO_CONTENEDORES_RUTA} contenedores por ruta.`;
        aviso.style.color = "#2f7a4d";
        if (btnGuardar) btnGuardar.disabled = false;
    } else {
        aviso.textContent = `Listo — ${marcados} contenedores seleccionados.`;
        aviso.style.color = "#2f7a4d";
        if (btnGuardar) btnGuardar.disabled = false;
    }
}

// Contenedores tildados en el checklist, en el orden en que aparecen ahí
// (alfabético por dirección, el mismo orden que ya devuelve
// ContenedorController::buscar) -- es la selección cruda, todavía sin pasar
// por ordenParaPersistir().
function contenedoresSeleccionadosRuta() {
    const idsMarcados = Array.from(
        document.querySelectorAll('#listaContenedoresRuta input[name="contenedores"]:checked')
    ).map((input) => input.value);

    return idsMarcados
        .map((id) => contenedoresDelBarrioRuta.find((c) => String(c.idContenedor) === String(id)))
        .filter(Boolean);
}

// Vecino más cercano: aproximación por distancia en línea recta (latitud/
// longitud), no por calles reales -- mismo tipo de criterio geométrico que
// ya usa 05_rutas_por_contenedor.sql para repartir contenedores entre
// rutas. Hasta el 15/10 era el ÚNICO criterio (a propósito no se usaba un
// servicio de ruteo real: traía API key y/o costo -- conversación con
// Matías, 14/10). Sigue existiendo y en uso: ahora es el respaldo si OSRM
// no responde (ver ordenPorOSRM/ordenParaPersistir más abajo) y el criterio
// del preview en vivo del campo "Recorrido" (ordenAproximadoLocal), que se
// recalcula en cada click del checklist y no tiene sentido que pegue a un
// servicio externo por cada tilde.
function distanciaContenedores(a, b) {
    const dx = Number(a.latitudContenedor) - Number(b.latitudContenedor);
    const dy = Number(a.longitudContenedor) - Number(b.longitudContenedor);
    return Math.sqrt(dx * dx + dy * dy);
}

function ordenVecinoMasCercano(contenedores) {
    const restantes = contenedores.slice();
    const orden = [restantes.shift()];

    while (restantes.length) {
        const actual = orden[orden.length - 1];
        let mejorIdx = 0;
        let mejorDist = Infinity;

        restantes.forEach((c, idx) => {
            const distancia = distanciaContenedores(actual, c);
            if (distancia < mejorDist) {
                mejorDist = distancia;
                mejorIdx = idx;
            }
        });

        orden.push(restantes.splice(mejorIdx, 1)[0]);
    }

    return orden;
}

// Orden LOCAL, sin red: vecino más cercano para los que tienen coordenadas
// + el resto (sin coordenadas) al final. Es lo que ordenParaPersistir hacía
// entero hasta el 15/10 -- ahora solo se usa para el preview en vivo de
// "Recorrido" (actualizarRecorridoAutocompletado) y como respaldo dentro de
// ordenParaPersistir si OSRM falla.
function ordenAproximadoLocal(seleccionados) {
    const conCoordenadas = seleccionados.filter((c) => c.latitudContenedor != null && c.longitudContenedor != null);
    const sinCoordenadas = seleccionados.filter((c) => !(c.latitudContenedor != null && c.longitudContenedor != null));

    if (conCoordenadas.length < 2) return seleccionados;

    return ordenVecinoMasCercano(conCoordenadas).concat(sinCoordenadas);
}

// Fase 6 (pedido de Matías, 15/10): el vecino más cercano en línea recta no
// sabe nada de calles -- 2 contenedores a 50 m en línea recta pero en
// veredas opuestas de una avenida ancha (sin cruce cerca) podían quedar
// seguidos en el orden, forzando al chofer a cruzar y volver. Para que el
// orden real respete la red vial (sentido de las calles, cruces reales) se
// usa OSRM (igual que Nominatim/Leaflet ya en uso: gratis, sin API key) --
// su servicio público de demo (router.project-osrm.org) expone /trip, que
// resuelve un TSP aproximado sobre el grafo vial real de OpenStreetMap.
//
// Se llama SOLO al confirmar la ruta (ordenParaPersistir), nunca en cada
// click del checklist -- es un servidor público de uso liviano, no para
// automatizar un pedido por cada tilde (esto último sigue usando
// ordenAproximadoLocal, sin red, arriba).
const OSRM_TRIP_URL = "https://router.project-osrm.org/trip/v1/driving";
const OSRM_TIMEOUT_MS = 6000;

// null si OSRM no está disponible, tarda más de OSRM_TIMEOUT_MS, o devuelve
// algo inesperado -- ordenParaPersistir cae al heurístico local en ese caso,
// nunca se bloquea la creación de una ruta por un servicio externo caído.
async function ordenPorOSRM(conCoordenadas) {
    if (conCoordenadas.length < 2) return null;

    const coordenadas = conCoordenadas
        .map((c) => `${Number(c.longitudContenedor)},${Number(c.latitudContenedor)}`)
        .join(";");

    const controlador = new AbortController();
    const temporizador = setTimeout(() => controlador.abort(), OSRM_TIMEOUT_MS);

    try {
        const parametros = new URLSearchParams({ roundtrip: "false", source: "first", overview: "false" });
        const respuesta = await fetch(`${OSRM_TRIP_URL}/${coordenadas}?${parametros.toString()}`, {
            signal: controlador.signal
        });
        const datos = await respuesta.json().catch(() => null);

        if (!respuesta.ok || !datos || datos.code !== "Ok" || !Array.isArray(datos.waypoints)) return null;
        if (datos.waypoints.length !== conCoordenadas.length) return null;

        // waypoints[i].waypoint_index: posición del punto de ENTRADA i (en
        // el mismo orden en que se mandaron las coordenadas) dentro del
        // recorrido ya optimizado -- se reordena el array original según eso.
        return conCoordenadas
            .map((contenedor, indice) => ({ contenedor, posicion: datos.waypoints[indice].waypoint_index }))
            .sort((a, b) => a.posicion - b.posicion)
            .map((par) => par.contenedor);
    } catch (error) {
        return null;
    } finally {
        clearTimeout(temporizador);
    }
}

// "Av. Brasil 1220" -> "Av. Brasil" (saca el número de puerta final).
function nombreCalleContenedor(direccion) {
    return (direccion || "").replace(/\s+\d+\s*$/, "").trim();
}

function calleDesdeOrdenRuta(orden) {
    const calles = [];
    orden.forEach((c) => {
        const calle = nombreCalleContenedor(c.ubicacionContenedor);
        if (calle && calles[calles.length - 1] !== calle) calles.push(calle);
    });
    return calles.join(" - ");
}

// Orden final a persistir en contenedor.ordenRutaContenedor: se intenta
// primero con OSRM (orden real sobre la red vial, ver ordenPorOSRM arriba);
// si no responde a tiempo, está caído, o devuelve algo inesperado, se cae
// al heurístico local de vecino más cercano. El resto (si algún contenedor
// no tiene lat/lng cargada) va al final en el orden en que se habían
// tildado -- nunca se pierde un contenedor seleccionado por no tener
// coordenadas, con ningún criterio.
async function ordenParaPersistir(seleccionados) {
    const conCoordenadas = seleccionados.filter((c) => c.latitudContenedor != null && c.longitudContenedor != null);
    const sinCoordenadas = seleccionados.filter((c) => !(c.latitudContenedor != null && c.longitudContenedor != null));

    if (conCoordenadas.length < 2) return seleccionados;

    const ordenReal = (await ordenPorOSRM(conCoordenadas)) || ordenVecinoMasCercano(conCoordenadas);
    return ordenReal.concat(sinCoordenadas);
}

// Botón "Recalcular orden con OSRM" del detalle de Rutas (15/10/2026, 3ra
// vuelta -- pedido de Matías: una ruta ya creada (ej. la de prueba de
// Martín Silva) se arma a mano o quedó con el orden viejo de antes de que
// existiera ordenParaPersistir/OSRM, y no hay forma de recalcularla sin
// recrearla entera. En vez de que alguien más tenga que iniciar sesión como
// admin para forzar el guardado, el propio admin (ya logueado en su sesión)
// lo dispara él mismo desde acá. Reusa la MISMA lógica de ordenParaPersistir
// que ya corre al crear una ruta nueva (OSRM sobre la red vial, con
// respaldo al heurístico local si OSRM no responde) -- no hay un criterio
// "para recalcular" distinto del de "al crear".
async function manejarRecalcularOrdenRuta(id) {
    const boton = document.querySelector(`[data-recalcular-orden="${id}"]`);
    const textoOriginal = boton ? boton.textContent : null;
    if (boton) {
        boton.disabled = true;
        boton.textContent = "Calculando orden de recolección...";
    }

    const contenedoresRuta = await Model.obtenerContenedoresDeRuta(id);
    if (!contenedoresRuta.length) {
        alert("Esta ruta todavía no tiene contenedores asignados.");
        if (boton) {
            boton.disabled = false;
            boton.textContent = textoOriginal;
        }
        return;
    }

    const contenedoresFinal = await ordenParaPersistir(contenedoresRuta);
    await Model.reordenarContenedoresDeRuta(id, contenedoresFinal);

    await mostrarModulo();
    await mostrarDetalle(id);
}

// Autocompleta "Recorrido" con las calles del orden de recolección calculado
// -- en silencio, sin mostrarle el orden a quien arma la ruta (no le
// interesa, solo elegir barrio y contenedores -- Matías, 14/10, 2da vuelta).
// Se recalcula cada vez que cambia la selección, mientras el admin no haya
// escrito nada a mano en ese campo todavía. A propósito usa el heurístico
// LOCAL (ordenAproximadoLocal), no ordenParaPersistir/OSRM -- se dispara en
// cada click del checklist y no tiene sentido pegarle a un servicio externo
// por cada tilde, para un campo que es solo un texto orientativo. El orden
// real (con OSRM) se calcula una sola vez, al confirmar, en
// manejarFormularioSubmit -- puede no coincidir exactamente con este
// preview, pero el preview nunca pretendió ser el orden final.
function actualizarRecorridoAutocompletado() {
    if (recorridoEditadoManualmente) return;

    const seleccionados = contenedoresSeleccionadosRuta();
    if (seleccionados.length < 2) return;

    document.getElementById("campoRutaRecorrido").value = calleDesdeOrdenRuta(ordenAproximadoLocal(seleccionados));
}

function activarFormularioRuta() {
    contenedoresDelBarrioRuta = [];
    recorridoEditadoManualmente = false;

    const selectBarrio = document.getElementById("campoRutaBarrio");
    const campoMunicipio = document.getElementById("campoRutaMunicipio");
    const campoRecorrido = document.getElementById("campoRutaRecorrido");
    const zonaSinElegir = document.getElementById("zonaRutaSinElegir");
    const bloqueContenedores = document.getElementById("bloqueContenedoresRuta");
    const listaContenedores = document.getElementById("listaContenedoresRuta");

    selectBarrio.addEventListener("change", async () => {
        const barrio = selectBarrio.value;
        recorridoEditadoManualmente = false;
        document.getElementById("buscarContenedoresRuta").value = "";

        if (!barrio) {
            zonaSinElegir.style.display = "";
            bloqueContenedores.style.display = "none";
            campoMunicipio.value = "";
            document.getElementById("contadorContenedoresRuta").textContent = "";
            contenedoresDelBarrioRuta = [];
            const btnGuardar = botonGuardarRuta();
            if (btnGuardar) btnGuardar.disabled = false;
            return;
        }

        contenedoresDelBarrioRuta = await Model.obtenerContenedoresDeBarrio(barrio);

        // El municipio no lo tipea el admin: se saca de los propios
        // contenedores del barrio (todos los de un mismo barrio deberían
        // compartirlo) -- ver Model.crearRutaConContenedores, que hace lo
        // mismo al guardar.
        const primerConMunicipio = contenedoresDelBarrioRuta.find((c) => c.municipioContenedor);
        campoMunicipio.value = primerConMunicipio ? primerConMunicipio.municipioContenedor : "";

        zonaSinElegir.style.display = "none";
        bloqueContenedores.style.display = "";
        View.renderContenedoresRuta(contenedoresDelBarrioRuta);
        actualizarContadorContenedoresRuta();
    });

    listaContenedores.addEventListener("change", (evento) => {
        if (evento.target.name !== "contenedores") return;
        actualizarContadorContenedoresRuta();
        actualizarRecorridoAutocompletado();
    });

    // En cuanto el admin toca este campo a mano, dejamos de pisarlo con el autocompletado.
    campoRecorrido.addEventListener("input", () => {
        recorridoEditadoManualmente = true;
    });

    View.activarBuscador("buscarContenedoresRuta", "#listaContenedoresRuta .checkbox-operario");
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

        // Cuadrilla nueva: no hay id propio para excluir -- cualquier jefe/chofer/
        // operario que ya esté en otra cuadrilla requiere confirmación.
        if (!(await confirmarJefeOChoferDeCuadrilla("jefe", jefeId, null))) return;
        if (!(await confirmarJefeOChoferDeCuadrilla("chofer", choferId, null))) return;
        for (const operarioId of operariosSeleccionados) {
            if (!(await confirmarOperarioDeCuadrilla(operarioId, null))) return;
        }

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

    // Alta de ruta: además de los campos de siempre, hay que validar el
    // mínimo/máximo de contenedores y mandarlos ya en su orden final de
    // recolección (se calcula acá, no se le mostró a quien arma la ruta).
    if (moduloActual === "rutas") {
        const formulario = evento.target;
        const valoresCampos = {
            nombre: formulario.elements["nombre"].value,
            zona: formulario.elements["zona"].value,
            recorrido: formulario.elements["recorrido"].value,
            frecuencia: formulario.elements["frecuencia"].value,
            horario: formulario.elements["horario"].value
        };

        const seleccionados = contenedoresSeleccionadosRuta();
        const minimo = minimoContenedoresParaBarrio(contenedoresDelBarrioRuta.length);

        // El botón Guardar ya queda deshabilitado mientras no se llega al
        // mínimo, y las casillas se deshabilitan al llegar al máximo (ver
        // actualizarContadorContenedoresRuta), pero se valida de nuevo acá
        // por si el envío se dispara de otra forma (Enter).
        if (!valoresCampos.zona || seleccionados.length < minimo) {
            alert(`Hay que elegir un barrio y asignarle al menos ${minimo} contenedores a esta ruta.`);
            return;
        }
        if (seleccionados.length > MAXIMO_CONTENEDORES_RUTA) {
            alert(`Una ruta no puede tener más de ${MAXIMO_CONTENEDORES_RUTA} contenedores -- desmarcá ${seleccionados.length - MAXIMO_CONTENEDORES_RUTA}.`);
            return;
        }

        // Acá -- no antes -- se calcula el orden real de recolección que va
        // a quedar guardado en contenedor.ordenRutaContenedor: a quien arma
        // la ruta no le interesa verlo, solo elegir barrio y contenedores
        // (Matías, 14/10, 2da vuelta); el chofer/jefe/operario lo ven
        // reflejado como el orden de las paradas en su propio panel. Desde
        // el 15/10 esto pega a OSRM (ver ordenParaPersistir) y puede tardar
        // hasta unos segundos -- se avisa en el botón para que no parezca
        // que el clic no hizo nada.
        const btnGuardarRuta = botonGuardarRuta();
        const textoOriginalBtnGuardar = btnGuardarRuta ? btnGuardarRuta.textContent : null;
        if (btnGuardarRuta) {
            btnGuardarRuta.disabled = true;
            btnGuardarRuta.textContent = "Calculando orden de recolección...";
        }

        const contenedoresFinal = await ordenParaPersistir(seleccionados);

        if (btnGuardarRuta) {
            btnGuardarRuta.disabled = false;
            btnGuardarRuta.textContent = textoOriginalBtnGuardar;
        }

        View.cerrarModal();

        const nueva = await Model.crearRutaConContenedores(valoresCampos, contenedoresFinal);
        if (!nueva) return;

        await mostrarModulo();
        await mostrarDetalle(nueva.id);
        return;
    }

    const config = Model.obtenerConfigAlta(moduloActual);
    if (!config) return;

    const formulario = evento.target;
    const valoresCampos = {};

    config.campos.forEach((campo) => {
        valoresCampos[campo.nombre] = formulario.elements[campo.nombre].value;
    });

    if (moduloActual === "camiones" && !(await confirmarChoferDeCamion(valoresCampos.choferId, null))) return;

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

    // El formulario ya exige el mínimo (minlength/pattern); esto solo
    // debería pasar si el servidor lo rechazó por otro motivo (ítem 11).
    if (resultado === "CONTRASENA_DEBIL") {
        alert("La contraseña debe tener al menos 8 caracteres, con al menos una letra y un número.");
        return;
    }

    View.cerrarModal();
    await mostrarModulo();
}

// Edición de un registro existente: "Editar" transforma el popup de detalle en un formulario in place.

function abrirFormularioEdicion(id) {
    const config = Model.obtenerConfigEdicion(moduloActual, id);
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

    const config = Model.obtenerConfigEdicion(moduloActual, idEnEdicion);
    if (!config) return;

    const formulario = evento.target;
    const valoresCampos = {};

    config.campos.forEach((campo) => {
        valoresCampos[campo.nombre] = formulario.elements[campo.nombre].value;
    });

    if (moduloActual === "camiones" && !(await confirmarChoferDeCamion(valoresCampos.choferId, idEnEdicion))) return;

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
        jefes: Model.obtenerJefesDisponibles(id),
        choferes: Model.obtenerChoferesDisponibles(id),
        rutas: Model.obtenerRutas(),
        operarios: Model.obtenerOperariosDisponibles(id)
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

    if (!(await confirmarJefeOChoferDeCuadrilla("jefe", jefeId, idEnEdicion))) return;
    if (!(await confirmarJefeOChoferDeCuadrilla("chofer", choferId, idEnEdicion))) return;
    for (const idOperario of operariosSeleccionados) {
        if (!(await confirmarOperarioDeCuadrilla(idOperario, idEnEdicion))) return;
    }

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

    document.getElementById("searchInput").addEventListener("input", mostrarModuloDesdeFiltroDebounced);
    document.getElementById("stateFilter").addEventListener("change", mostrarModuloDesdeFiltro);

    // Cantidad de registros por página (10/25/50, arranca en 10) - al cambiarla
    // se vuelve a la página 1, igual que un cambio de filtro, para no quedar
    // apuntando a un rango de la paginación anterior que ya no corresponde.
    document.getElementById("pageSizeSelect").addEventListener("change", (evento) => {
        registrosPorPagina = Number(evento.target.value) || 10;
        mostrarModuloDesdeFiltro();
    });

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
    // recuperarUsuarioActual() consulta al servidor si esta pestaña no tiene
    // la copia local (pegar la URL en una pestaña nueva, por ejemplo) --
    // antes se miraba solo Model.usuarioActual y se mostraba "Acceso no
    // autorizado" aunque la sesión del servidor siguiera activa.
    const usuario = await Model.recuperarUsuarioActual();

    if (usuario && usuario.rol === "administrador") {
        iniciarEventos();
        await cambiarModulo("resumen");
        await iniciarCuenta();
    } else {
        View.mostrarAccesoNoAutorizado();
    }
}
