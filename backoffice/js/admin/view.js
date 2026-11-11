// VISTA
// Funciones que arman/actualizan el HTML del panel administrador a partir
// de datos ya resueltos. No decide reglas de negocio, solo pinta.
//
// Punto 27 de la Fase 4 (16/10/2026): este archivo ahora es solo un
// "aggregator" -- la lógica real se separó por tema en la carpeta view/
// (helpers de texto/fecha/HTML + buscador, encabezado y controles del
// módulo, Resumen, Informe de incidencias, Listado, Popup de detalle, Modal
// de alta). Nada cambió para quien importa este archivo (controller.js) --
// mismo `import * as View from "./view.js?v=N"`, exactamente los mismos
// nombres exportados que antes. Cada reexport abajo tiene su propio `?v=1`
// (misma convención de cache-busting que model.js, ver
// sigeru-frontend/README.md) para que un futuro cambio a un solo archivo de
// view/ pueda bumpear solo esa línea sin tocar las demás.

export { claseEstado, escapeHtml, formatearFechaHora, crearDetalleItem, activarBuscador } from "./view/helpers.js?v=1";
export {
    actualizarEncabezadoModulo,
    actualizarFiltroEstados,
    limpiarBusqueda,
    mostrarHerramientasModulo,
    actualizarLayoutModulo,
    actualizarBotonNuevo,
    actualizarBotonExportar,
    renderFiltrosExtra
} from "./view/encabezado-controles.js?v=1";
export {
    mostrarTarjetasResumen,
    ocultarTarjetasResumen,
    renderGraficosResumen,
    mostrarMensajeDetalleInicial,
    renderUltimasIncidencias
} from "./view/resumen.js";
export { renderInformeIncidencias } from "./view/informe.js?v=1";
export { renderListaRegistros, renderPaginador } from "./view/listados.js?v=1";
export { abrirDetailModal, cerrarDetailModal, renderDetalle } from "./view/detalle-modal.js?v=1";
export {
    renderFormularioAltaCuadrilla,
    renderFormularioEdicionCuadrillaEnDetalle,
    renderFormularioAltaRuta,
    renderContenedoresRuta,
    renderCamposFormulario,
    renderListaMaquinariaModal,
    abrirModal,
    cerrarModal,
    mostrarAccesoNoAutorizado
} from "./view/formularios.js";
