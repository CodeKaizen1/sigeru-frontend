// Punto 27 de la Fase 4: Lectura / filtrado (síncrono, lee `datos` ya
// cargado) -- búsqueda, filtros, orden de exportación. Mismo bloque que en
// el model.js original.
import { datos, coleccion, normalizarTexto } from "./estado.js";
import { configuracionModulos } from "./config-modulos.js";
import { nombreFuncionario } from "./funcionarios.js";
import { obtenerCuadrillaDeChofer, obtenerCuadrillaDeRuta } from "./cuadrillas-camiones-rutas.js";

function filasCuadrillas() {
    return datos.cuadrillas.map((cuadrilla) => ({
        ...cuadrilla,
        _jefeNombre: cuadrilla.jefeId ? (nombreFuncionario(cuadrilla.jefeId) || "Sin asignar") : "Sin asignar",
        _choferNombre: cuadrilla.choferId ? (nombreFuncionario(cuadrilla.choferId) || "Sin asignar") : "Sin asignar",
        _operariosCantidad: cuadrilla.operarios.length,
        _rutaResumen: (() => {
            const ruta = datos.rutas.find((r) => r.id === cuadrilla.rutaId);
            return ruta ? `${ruta.nombre || ruta.zona} (${ruta.horario})` : "Sin ruta asignada";
        })()
    }));
}

function filasCamiones() {
    return datos.camiones.map((camion) => {
        const cuadrilla = camion.choferId ? obtenerCuadrillaDeChofer(camion.choferId) : null;
        return {
            ...camion,
            _choferNombre: camion.choferId ? (nombreFuncionario(camion.choferId) || "Sin asignar") : "Sin asignar",
            _rutaResumen: cuadrilla && cuadrilla.ruta
                ? `${cuadrilla.ruta.nombre || cuadrilla.ruta.zona} (${cuadrilla.ruta.horario})`
                : "Sin ruta asignada"
        };
    });
}

function filasRutas() {
    return datos.rutas.map((ruta) => {
        const cuadrilla = obtenerCuadrillaDeRuta(ruta.id);
        return {
            ...ruta,
            _cuadrillaResumen: cuadrilla
                ? `Cuadrilla ${cuadrilla.id} (jefe: ${cuadrilla.jefe ? `${cuadrilla.jefe.nombre} ${cuadrilla.jefe.apellido}` : "sin asignar"})`
                : "Sin cuadrilla asignada"
        };
    });
}

export function filtrarRegistros(modulo, textoBusqueda, estadoSeleccionado, filtrosExtraValores = {}, fechaSeleccionada = "") {
    const texto = normalizarTexto(textoBusqueda);
    const registros = modulo === "cuadrillas" ? filasCuadrillas()
        : modulo === "camiones" ? filasCamiones()
        : modulo === "rutas" ? filasRutas()
        : coleccion(modulo);

    const campoEstado = modulo === "rutas" ? "estadoAdmin" : "estado";
    const campoFecha = configuracionModulos[modulo] ? configuracionModulos[modulo].filtroFecha : null;

    return registros.filter((registro) => {
        const coincideEstado = estadoSeleccionado === "todos" || registro[campoEstado] === estadoSeleccionado;

        const textoRegistro = normalizarTexto(Object.values(registro).filter((v) => typeof v !== "object").join(" "));
        const coincideBusqueda = textoRegistro.includes(texto);

        const coincideExtra = Object.entries(filtrosExtraValores).every(([campo, valor]) => {
            if (!valor || valor === "todos") return true;
            return registro[campo] === valor;
        });

        const coincideFecha = !campoFecha || !fechaSeleccionada
            ? true
            : coincideFechaConFiltro(registro[campoFecha], fechaSeleccionada);

        return coincideEstado && coincideBusqueda && coincideExtra && coincideFecha;
    });
}

function coincideFechaConFiltro(fechaTexto, fechaFiltroISO) {
    if (!fechaTexto) return false;

    const [dia, mes, anio] = fechaTexto.split("/");
    if (!dia || !mes || !anio) return false;

    const fechaRegistroISO = `${anio}-${mes.padStart(2, "0")}-${dia.padStart(2, "0")}`;
    return fechaRegistroISO === fechaFiltroISO;
}

export function valoresUnicos(modulo, campo) {
    return [...new Set(
        coleccion(modulo)
            .map((item) => item[campo])
            .filter((valor) => valor !== null && valor !== undefined && valor !== "")
    )].sort((a, b) => a.localeCompare(b, "es"));
}

export function obtenerFiltrosExtra(modulo) {
    const config = configuracionModulos[modulo];
    if (!config || !config.filtrosExtra) return [];

    return config.filtrosExtra.map((filtro) => ({
        campo: filtro.campo,
        etiqueta: filtro.etiqueta,
        todosLabel: filtro.todosLabel || `Todos: ${filtro.etiqueta}`,
        opciones: filtro.opciones === "dinamico" ? valoresUnicos(modulo, filtro.campo) : filtro.opciones
    }));
}

export function obtenerColumnasExport(modulo) {
    const config = configuracionModulos[modulo];
    return config && config.columnasExport ? config.columnasExport : null;
}

export function filasParaExportar(modulo, registros) {
    const columnas = obtenerColumnasExport(modulo);
    if (!columnas) return null;

    const encabezados = columnas.map((columna) => columna.etiqueta);
    const filas = registros.map((registro) =>
        columnas.map((columna) => {
            const valor = registro[columna.campo];
            if (valor === null || valor === undefined || valor === "") {
                return columna.valorVacio !== undefined ? columna.valorVacio : "";
            }
            return String(valor);
        })
    );

    return { encabezados, filas };
}
