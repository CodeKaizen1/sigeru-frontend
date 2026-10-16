// Modelo: capa adaptadora async contra las 3 APIs reales (api-usuarios,
// api-gestion, api-recoleccion). Expone las mismas funciones y campos que
// antes usaba view.js/controller.js, así que quien llama no cambió.
// Los ids que salen de acá siempre son string. El id de "funcionario" es
// la cédula (no idOperarioDeCuadrilla); notificaciones y el texto de
// resolución de incidencias no tienen backend real todavía y quedan stub.
//
// Punto 27 de la Fase 4 (16/10/2026): este archivo ahora es solo un
// "aggregator" -- la lógica real se separó por tema en la carpeta model/
// (estado, orquestación de carga, contenedores+incidencias, cuadrillas+
// camiones+rutas, instalaciones, funcionarios, notificaciones, config de
// módulos, lectura/filtrado, CRUD genérico). Nada cambió para quien
// importa este archivo (controller.js, panel-chofer.js, panel-jefe.js,
// panel-operario.js, recalcular-rutas-existentes.js) -- mismo
// `import * as Model from "./model.js?v=N"`, exactamente los mismos
// nombres exportados que antes. Cada reexport abajo tiene su propio
// `?v=1` (convención de cache-busting, ver sigeru-frontend/README.md) para
// que un futuro cambio a un solo archivo de model/ pueda bumpear solo esa
// línea sin tocar las demás.

export { datos, normalizarTexto, obtenerRegistroPorId } from "./model/estado.js?v=1";
export { recargarDatos, obtenerRegistros } from "./model/orquestacion-carga.js?v=1";
export {
    distribucionContenedoresPorEstado,
    cambiarEstadoIncidencia,
    marcarIncidenciaResuelta,
    asignarCuadrillaAIncidencia,
    obtenerContenedoresDeRutaDeCuadrilla,
    obtenerContenedoresDeRuta,
    obtenerBarriosDisponibles,
    obtenerContenedoresDeBarrio,
    crearRutaConContenedores,
    reordenarContenedoresDeRuta,
    crearIncidenciaDesdeCuadrilla,
    obtenerUltimasIncidencias,
    contarIncidenciasAbiertas,
    distribucionIncidenciasPorEstado,
    distribucionIncidenciasPorTipo,
    opcionesZonaInformeIncidencias,
    opcionesTipoInformeIncidencias,
    generarInformeIncidencias,
    filasInformeIncidenciasParaExportar
} from "./model/contenedores-incidencias.js?v=1";
export {
    asignarChoferACamion,
    obtenerCuadrillas,
    obtenerCuadrillaPorId,
    detalleCuadrilla,
    obtenerCuadrillaDeChofer,
    obtenerCuadrillaDeRuta,
    obtenerCuadrillaDeJefe,
    obtenerCuadrillaDeOperario,
    obtenerOtraCuadrillaDeJefe,
    obtenerOtraCuadrillaDeChofer,
    obtenerOtraCuadrillaDeOperario,
    obtenerOtroCamionDeChofer,
    obtenerOperariosDisponibles,
    obtenerJefesDisponibles,
    obtenerChoferesDisponibles,
    obtenerOtrasCuadrillas,
    obtenerCamionesDisponibles,
    obtenerRutas,
    opcionesCuadrillaParaAsignar,
    opcionesRutasParaAsignar,
    opcionesChoferParaCamion,
    asignarJefeACuadrilla,
    asignarChoferACuadrilla,
    asignarRutaACuadrilla,
    crearCuadrilla,
    moverOperario,
    distribucionRutasPorFrecuencia,
    iniciarRuta,
    finalizarRuta,
    camionTieneRutaAsignada
} from "./model/cuadrillas-camiones-rutas.js?v=1";
export {
    obtenerMaquinariaDeInstalacion,
    agregarMaquinaria,
    cambiarEstadoMaquinaria,
    quitarMaquinaria
} from "./model/instalaciones.js?v=1";
export {
    nombreFuncionario,
    contarFuncionariosActivos,
    obtenerSolicitudesPendientes,
    aprobarSolicitud,
    rechazarSolicitud,
    usuarioActual,
    recuperarUsuarioActual,
    obtenerPerfilPropio,
    actualizarCuentaPropia
} from "./model/funcionarios.js?v=1";
export {
    obtenerNotificacionesAdmin,
    obtenerNotificacionesCuadrilla,
    marcarNotificacionesLeidas
} from "./model/notificaciones.js?v=1";
export {
    configuracionModulos,
    ordenarRegistros,
    formulariosAlta,
    configEdicionFuncionarios,
    obtenerConfigEdicion,
    obtenerConfigAlta
} from "./model/config-modulos.js?v=1";
export {
    filtrarRegistros,
    obtenerFiltrosExtra,
    obtenerColumnasExport,
    filasParaExportar
} from "./model/lectura-filtrado.js?v=1";
export { crearRegistro, editarRegistro, alternarBaja } from "./model/crud-generico.js?v=1";
