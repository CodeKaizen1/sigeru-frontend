// Punto 27 de la Fase 4: Contenedores + Incidencias + "Nueva ruta"
// (asignación de contenedores a una ruta) + Informe de incidencias
// (api-gestion/api-recoleccion) -- se mantienen juntos en un solo archivo
// porque en el model.js original también lo estaban (un mismo bloque,
// fuertemente interdependiente: cargarContenedores/cargarIncidencias se
// necesitan entre sí para el resumen de incidencias por contenedor, y
// crearRutaConContenedores cruza datos de las 3 cosas).
import { datos, llamarGestion, llamarRecoleccion, obtenerRegistroPorId, formatearFechaCorta, fechaHoraParaMySQL, contarPorCategoria } from "./estado.js";
import { configuracionModulos } from "./config-modulos.js";
import { cargarRutas, detalleCuadrilla } from "./cuadrillas-camiones-rutas.js";
import { valoresUnicos } from "./lectura-filtrado.js";

let _cacheContenedoresPorId = new Map();

export async function cargarContenedores() {
    const { ok, datos: filas } = await llamarGestion("contenedor", "GET");
    if (!ok || !Array.isArray(filas)) return;

    _cacheContenedoresPorId = new Map();

    datos.contenedores = filas.map((fila) => {
        const item = {
            id: String(fila.idContenedor),
            estado: fila.estadoContenedor || "",
            ubicacion: fila.ubicacionContenedor || "",
            capacidad: fila.capacidadContenedor || "",
            tipoResiduo: fila.tipoResiduoContenedor || "",
            // Coordenadas para el mapa interactivo -- opcionales, string vacio
            // si no estan cargadas (coincide con como el <input type="number">
            // del formulario espera el valor inicial).
            latitud: fila.latitudContenedor ?? "",
            longitud: fila.longitudContenedor ?? "",
            // Barrio y municipio (entrega final, contenedores oficiales IMM
            // enriquecidos) -- string vacio si no estan cargados (contenedores
            // creados a mano desde el panel pueden no tenerlos).
            zona: fila.zonaContenedor || "",
            municipio: fila.municipioContenedor || "",
            incidencias: calcularResumenIncidenciasContenedor(fila.idContenedor)
        };
        _cacheContenedoresPorId.set(item.id, item);
        return item;
    });
}

function calcularResumenIncidenciasContenedor(idContenedor) {
    const abiertas = datos.incidencias.filter(
        (inc) => inc._idContenedorReal === String(idContenedor) && inc.estado !== "resuelta"
    ).length;

    if (abiertas === 0) return "Sin incidencias abiertas";
    return `${abiertas} incidencia${abiertas === 1 ? "" : "s"} abierta${abiertas === 1 ? "" : "s"}`;
}

export function recomputarResumenIncidenciasEnContenedores() {
    datos.contenedores.forEach((c) => {
        c.incidencias = calcularResumenIncidenciasContenedor(c.id);
    });
}

export function distribucionContenedoresPorEstado() {
    return contarPorCategoria(datos.contenedores, "estado", configuracionModulos.contenedores.estados);
}

export async function cargarIncidencias() {
    const { ok, datos: filas } = await llamarGestion("incidencia", "GET");
    if (!ok || !Array.isArray(filas)) return;

    datos.incidencias = filas.map((fila) => {
        const contenedor = fila.idContenedor != null ? _cacheContenedoresPorId.get(String(fila.idContenedor)) : null;

        return {
            id: String(fila.idIncidencia),
            tipo: fila.tipoIncidencia || "",
            estado: fila.estadoIncidencia || "",
            zona: fila.zonaIncidencia || "",
            fecha: formatearFechaCorta(fila.fechaReporte),
            descripcion: fila.descripcionIncidencia || "",
            contenedor: contenedor ? (contenedor.ubicacion || "Sin dirección") : "Sin contenedor asociado",
            cuadrillaId: fila.idCuadrilla != null ? String(fila.idCuadrilla) : null,
            resolucion: fila.resolucionIncidencia || null,
            fechaResolucion: fila.fechaResolucionIncidencia || null,
            _descripcionCruda: fila.descripcionIncidencia,
            _idContenedorReal: fila.idContenedor != null ? String(fila.idContenedor) : null,
            _fechaReporteCruda: fila.fechaReporte
        };
    });
}

function cuerpoIncidencia(incidencia, cambios = {}) {
    return {
        idIncidencia: Number(incidencia.id),
        descripcionIncidencia: "descripcionIncidencia" in cambios ? cambios.descripcionIncidencia : incidencia._descripcionCruda,
        estadoIncidencia: "estadoIncidencia" in cambios ? cambios.estadoIncidencia : incidencia.estado,
        emailResponsableIncidencia: null,
        tipoIncidencia: incidencia.tipo,
        zonaIncidencia: incidencia.zona,
        fechaReporte: incidencia._fechaReporteCruda,
        idContenedor: incidencia._idContenedorReal !== null ? Number(incidencia._idContenedorReal) : null,
        idCuadrilla: "idCuadrilla" in cambios
            ? (cambios.idCuadrilla !== null ? Number(cambios.idCuadrilla) : null)
            : (incidencia.cuadrillaId !== null ? Number(incidencia.cuadrillaId) : null),
        resolucionIncidencia: "resolucionIncidencia" in cambios ? cambios.resolucionIncidencia : incidencia.resolucion,
        fechaResolucionIncidencia: "fechaResolucionIncidencia" in cambios ? cambios.fechaResolucionIncidencia : incidencia.fechaResolucion
    };
}

// Cambia el estado de una incidencia. Al pasar a "resuelta" exige el detalle
// de resolución (devuelve "RESOLUCION_REQUERIDA" si falta). Punto 36 de la
// Fase 6: al REABRIR una incidencia ya resuelta (resuelta -> abierta/en
// curso) también se exige un motivo (devuelve "JUSTIFICACION_REQUERIDA" si
// falta) -- y, a diferencia de antes, ya no se pierde el texto de la
// resolución original: el motivo de la reapertura se agrega al final del
// mismo campo resolucionIncidencia con fecha, en vez de machacarlo con null
// (se eligió reusar el campo existente en vez de sumar uno nuevo a la tabla,
// para no tocar el esquema a esta altura -- ver la pregunta abierta en
// plan_pasos_correccion_auditoria_08_10_2026.md, punto 36).
export async function cambiarEstadoIncidencia(idIncidencia, nuevoEstado, resolucionDetalle = "", motivoReapertura = "") {
    const incidencia = obtenerRegistroPorId("incidencias", idIncidencia);
    if (!incidencia) return null;

    const seEstaReabriendo = incidencia.estado === "resuelta" && nuevoEstado !== "resuelta";

    let resolucion = null;
    let fechaResolucion = null;

    if (nuevoEstado === "resuelta") {
        const detalle = (resolucionDetalle || "").trim();
        if (!detalle) return "RESOLUCION_REQUERIDA";
        resolucion = detalle;
        fechaResolucion = new Date().toISOString();
    } else if (seEstaReabriendo) {
        const motivo = (motivoReapertura || "").trim();
        if (!motivo) return "JUSTIFICACION_REQUERIDA";

        const fechaTexto = formatearFechaCorta(new Date().toISOString());
        resolucion = incidencia.resolucion
            ? `${incidencia.resolucion}\n\n[Reabierta el ${fechaTexto}] ${motivo}`
            : `[Reabierta el ${fechaTexto}] ${motivo}`;
        // La fecha de resolución original se deja como estaba -- el estado
        // ya deja en claro que ahora mismo no está resuelta, y así no se
        // pierde cuándo se había resuelto la primera vez.
        fechaResolucion = incidencia.fechaResolucion;
    }

    const { ok } = await llamarGestion("incidencia", "PUT", cuerpoIncidencia(incidencia, {
        estadoIncidencia: nuevoEstado,
        resolucionIncidencia: resolucion,
        fechaResolucionIncidencia: fechaResolucion
    }), idIncidencia);
    if (!ok) return null;

    incidencia.estado = nuevoEstado;
    incidencia.resolucion = resolucion;
    incidencia.fechaResolucion = fechaResolucion;
    return incidencia;
}

export async function marcarIncidenciaResuelta(idIncidencia, resolucionDetalle) {
    return cambiarEstadoIncidencia(idIncidencia, "resuelta", resolucionDetalle);
}

export async function asignarCuadrillaAIncidencia(idIncidencia, idCuadrilla) {
    const incidencia = obtenerRegistroPorId("incidencias", idIncidencia);
    if (!incidencia) return null;

    const cuadrillaIdNueva = idCuadrilla || null;

    const { ok } = await llamarGestion("incidencia", "PUT", cuerpoIncidencia(incidencia, { idCuadrilla: cuadrillaIdNueva }), idIncidencia);
    if (!ok) return null;

    incidencia.cuadrillaId = cuadrillaIdNueva;
    return incidencia;
}

// Contenedores de la ruta especifica asignada a una cuadrilla (para que el
// Jefe pueda elegir sobre cual es la incidencia que esta reportando, y para
// que chofer/jefe/operario vean las direcciones que LES TOCAN A ELLOS).
// Antes se pedia por barrio completo (ContenedorController::buscar con
// "barrio"), pero un barrio grande puede tener varias rutas reales
// distintas (ej. Pocitos: 396 contenedores en 12 rutas) -- un chofer no
// puede levantar todo el barrio, solo le corresponden los de SU ruta (ver
// contenedor.idRuta, 01_code.sql seccion 11, y ContenedorController::
// obtenerPorRuta). Si la ruta todavia no tiene ningun contenedor asignado
// (dato viejo, de antes de este cambio) devuelve vacio en vez de volver a
// traer todo el barrio -- es preferible mostrar "no hay nada cargado" a
// volver al bug de mostrar contenedores que no son de esa ruta.
export async function obtenerContenedoresDeRutaDeCuadrilla(idCuadrilla) {
    const cuadrilla = detalleCuadrilla(idCuadrilla);
    const idRuta = cuadrilla && cuadrilla.ruta ? cuadrilla.ruta.id : null;
    if (!idRuta) return [];

    return obtenerContenedoresDeRuta(idRuta);
}

// Igual que obtenerContenedoresDeRutaDeCuadrilla, pero directo por idRuta --
// sin resolver primero una cuadrilla. Pensado para recalcular-rutas-
// existentes.js (15/10/2026, 3ra vuelta -- ver ese archivo): ahí se tiene el
// id de la ruta de una, no el de una cuadrilla. Devuelve las filas crudas
// tal cual las manda el backend (mismo shape que obtenerContenedoresDeBarrio),
// listas para volver a mandarse en asignarContenedorARuta() sin remapear nada.
export async function obtenerContenedoresDeRuta(idRuta) {
    const { ok, datos: respuesta } = await llamarGestion("contenedor", "GET", undefined, null, { idRuta });
    return ok && Array.isArray(respuesta) ? respuesta : [];
}

// "Nueva ruta" (14/10/2026): elegir barrio y asignarle sus contenedores --
// ver claude/rutas_por_contenedor_09_10_2026.md para el porque de que un
// barrio pueda tener varias rutas, y 01_code.sql seccion 12 para las
// columnas nuevas que esto usa (ruta.municipioRuta, contenedor.idRuta ya
// existia, contenedor.ordenRutaContenedor).

// Barrios disponibles para el <select> de "Nueva ruta": los mismos que ya
// usa el buscador del mapa (ContenedorController::obtenerFiltrosDisponibles)
// -- no hace falta pedir los ~11.130 contenedores completos solo para armar
// esta lista.
export async function obtenerBarriosDisponibles() {
    const { ok, datos: respuesta } = await llamarGestion("contenedor", "GET", undefined, null, { accion: "filtros" });
    return ok && respuesta && Array.isArray(respuesta.barrios) ? respuesta.barrios : [];
}

// Contenedores de UN barrio completo, para el checklist de asignacion de
// "Nueva ruta" -- a diferencia de obtenerContenedoresDeRutaDeCuadrilla()
// (que pide por idRuta, una ruta puntual ya armada), esto trae TODOS los
// del barrio via ContenedorController::buscar(), para que el admin elija
// cuales le tocan a la ruta nueva (y vea cuales ya estan en otra ruta).
// Devuelve las filas tal cual las manda el backend, sin remapear nombres
// de columna: se vuelven a mandar casi sin cambios en asignarContenedorARuta().
// _otraRuta: {id, nombre} si el contenedor ya está asignado a OTRA ruta --
// mismo patrón que _otraCuadrilla en obtenerJefesDisponibles/etc, para que
// el checklist de "Nueva ruta" pueda mostrar esa etiqueta (ver
// construirCamposRutaHtml en view.js). Asume que datos.rutas ya está
// cargado -- cierto siempre que esto se llama desde el módulo Rutas, que ya
// hizo obtenerRegistros("rutas") al entrar.
function otraRutaDeContenedor(idRutaCruda) {
    if (idRutaCruda === null || idRutaCruda === undefined || idRutaCruda === "") return null;

    const ruta = datos.rutas.find((r) => r.id === String(idRutaCruda));
    if (!ruta) return null;

    return { id: ruta.id, nombre: ruta.nombre || ruta.zona };
}

export async function obtenerContenedoresDeBarrio(barrio) {
    const { ok, datos: respuesta } = await llamarGestion("contenedor", "GET", undefined, null, { barrio });
    if (!ok || !Array.isArray(respuesta)) return [];

    return respuesta.map((c) => ({ ...c, _otraRuta: otraRutaDeContenedor(c.idRuta) }));
}

// Asigna UN contenedor (fila cruda de obtenerContenedoresDeBarrio) a una
// ruta, en una posicion dada -- reenvia la fila completa porque
// ContenedorController::modificar() hace un UPDATE de todas las columnas,
// no un patch parcial.
async function asignarContenedorARuta(contenedorCrudo, idRuta, orden) {
    const { ok } = await llamarGestion("contenedor", "PUT", {
        idContenedor: contenedorCrudo.idContenedor,
        ubicacionContenedor: contenedorCrudo.ubicacionContenedor,
        estadoContenedor: contenedorCrudo.estadoContenedor,
        capacidadContenedor: contenedorCrudo.capacidadContenedor,
        tipoResiduoContenedor: contenedorCrudo.tipoResiduoContenedor,
        latitudContenedor: contenedorCrudo.latitudContenedor,
        longitudContenedor: contenedorCrudo.longitudContenedor,
        zonaContenedor: contenedorCrudo.zonaContenedor,
        municipioContenedor: contenedorCrudo.municipioContenedor,
        idRuta,
        ordenRutaContenedor: orden
    }, contenedorCrudo.idContenedor);

    return ok;
}

// Crea la ruta y le asigna, en el mismo paso, los contenedores que el admin
// tildó en "Nueva ruta". contenedoresOrdenados ya viene en el orden final a
// guardar (el sugerido por cercanía si el admin lo pidió con "Sugerir orden
// de recolección", o el orden en que estaban en el checklist si no) -- ese
// orden es lo que después ve el chofer/jefe/operario en su panel (ver
// ContenedorController::obtenerPorRuta, ORDER BY ordenRutaContenedor). El
// municipio de la ruta se saca del primer contenedor que lo tenga cargado
// (todos los de un mismo barrio deberían compartirlo).
export async function crearRutaConContenedores(valoresCampos, contenedoresOrdenados) {
    const primerConMunicipio = contenedoresOrdenados.find((c) => c.municipioContenedor);

    const { ok } = await llamarRecoleccion("ruta", "POST", {
        idRuta: null,
        zonaRuta: valoresCampos.zona,
        recorridoRuta: valoresCampos.recorrido,
        frecuenciaDeRecoleccionRuta: valoresCampos.frecuencia,
        horarioRuta: valoresCampos.horario,
        estadoRuta: "sin iniciar",
        horaInicioRealRuta: null,
        horaFinRealRuta: null,
        estadoAdminRuta: "activa",
        nombreRuta: valoresCampos.nombre || null,
        municipioRuta: primerConMunicipio ? primerConMunicipio.municipioContenedor : null
    });
    if (!ok) return null;

    await cargarRutas();
    const nueva = datos.rutas[datos.rutas.length - 1] || null;
    if (!nueva) return null;

    // for...of (no forEach) para esperar cada asignación en orden, igual
    // que el alta de cuadrillas con sus operarios (ver manejarFormularioSubmit
    // en controller.js).
    let indice = 1;
    for (const contenedor of contenedoresOrdenados) {
        await asignarContenedorARuta(contenedor, Number(nueva.id), indice);
        indice += 1;
    }

    await cargarContenedores();
    recomputarResumenIncidenciasEnContenedores();

    return nueva;
}

// Vuelve a persistir el orden de los contenedores que una ruta YA TENÍA
// asignados -- a diferencia de crearRutaConContenedores (que asigna
// contenedores a una ruta recién creada), esto reordena una ruta existente,
// uno por uno con un ordenRutaContenedor nuevo (mismo PUT de
// asignarContenedorARuta, reenviando el mismo idRuta sin cambios).
// `contenedoresEnOrden` ya viene en el orden final a guardar (ver
// recalcular-rutas-existentes.js, que es quien lo calcula con
// ordenParaPersistir/OSRM antes de llamar acá, una sola vez para TODAS las
// rutas que ya existían antes del 15/10 -- Matías pidió "recalculalas todas
// y ya", no un botón para ir ruta por ruta, ver ese archivo).
export async function reordenarContenedoresDeRuta(idRuta, contenedoresEnOrden) {
    let indice = 1;
    for (const contenedor of contenedoresEnOrden) {
        await asignarContenedorARuta(contenedor, Number(idRuta), indice);
        indice += 1;
    }

    await cargarContenedores();
    recomputarResumenIncidenciasEnContenedores();
}

// Crea una incidencia reportada por el Jefe de Cuadrilla para su propia cuadrilla.
export async function crearIncidenciaDesdeCuadrilla(idCuadrilla, { tipo, descripcion, idContenedor }) {
    const cuadrilla = detalleCuadrilla(idCuadrilla);
    if (!cuadrilla) return null;

    const zona = cuadrilla.ruta ? cuadrilla.ruta.zona : "Sin zona asignada";

    const cuerpo = {
        descripcionIncidencia: descripcion,
        estadoIncidencia: "abierta",
        emailResponsableIncidencia: null,
        tipoIncidencia: tipo,
        zonaIncidencia: zona,
        fechaReporte: fechaHoraParaMySQL(new Date()),
        idContenedor: idContenedor || null,
        idCuadrilla: Number(idCuadrilla)
    };

    const { ok, datos: respuesta } = await llamarGestion("incidencia", "POST", cuerpo);
    if (!ok || !respuesta || !respuesta.exito) return null;

    await cargarIncidencias();
    recomputarResumenIncidenciasEnContenedores();
    return obtenerRegistroPorId("incidencias", String(respuesta.idIncidencia));
}

export function obtenerUltimasIncidencias(cantidad = 5) {
    return [...datos.incidencias].sort((a, b) => Number(b.id) - Number(a.id)).slice(0, cantidad);
}

// Pedido de Matías (15/10): una incidencia "abierta" con una cuadrilla ya
// asignada no debería seguir contando como "abierta" en los números/gráficos
// de Resumen ni en el Informe -- ya la están trabajando, aunque el campo real
// estadoIncidencia (el que se ve/filtra en el listado de Incidencias y se
// cambia con "Cambiar estado") todavía no se haya tocado a mano. No hay un
// estado "asignada" en la base (solo estadoIncidencia + idCuadrilla) -- en vez
// de inventar uno nuevo y tocar el esquema, este helper calcula el estado
// EFECTIVO solo para estos 2 lugares (Resumen e Informe), sin cambiar el
// estado real ni lo que se ve en el listado/filtro de Incidencias (eso se
// deja como está a propósito, ver plan_pasos_correccion_auditoria_08_10_2026.md).
function estadoEfectivoIncidencia(incidencia) {
    if (incidencia.estado === "abierta" && incidencia.cuadrillaId) return "en curso";
    return incidencia.estado;
}

export function contarIncidenciasAbiertas() {
    return datos.incidencias.filter((incidencia) => estadoEfectivoIncidencia(incidencia) === "abierta").length;
}

// Misma lista fija que valida api-gestion/index.php (tipoIncidencia) y usa
// el <select> del formulario público -- se repite acá (no hay forma de leerla
// del backend) solo para que el gráfico de "Incidencias por tipo" del Resumen
// muestre siempre las 5 categorías en el mismo orden, aunque alguna tenga 0.
const TIPOS_INCIDENCIA = [
    "Contenedor desbordado",
    "Contenedor dañado",
    "Contenedor prendido fuego",
    "Residuos fuera de lugar",
    "Otra situación"
];

export function distribucionIncidenciasPorEstado() {
    // No se usa contarPorCategoria() genérico acá (a diferencia de
    // distribucionContenedoresPorEstado, que sigue igual) porque necesita el
    // estado EFECTIVO (ver estadoEfectivoIncidencia arriba), no el literal.
    return configuracionModulos.incidencias.estados.map((categoria) => ({
        categoria,
        cantidad: datos.incidencias.filter((incidencia) => estadoEfectivoIncidencia(incidencia) === categoria).length
    }));
}

export function distribucionIncidenciasPorTipo() {
    return contarPorCategoria(datos.incidencias, "tipo", TIPOS_INCIDENCIA);
}

//
// Informe de incidencias (Fase 4, punto 15). Mismo dataset ya cargado en
// memoria que usa el módulo Incidencias, pero filtrado por un RANGO de
// fechas (desde/hasta) en vez del filtro de un solo día que usa ese módulo
// -- un informe tipo "del 1 al 30 de este mes" necesita rango, no un día
// exacto, así que se arma aparte en vez de reusar filtrarRegistros().
//

// Mismas zonas/tipos presentes en los datos reales, para poblar los <select>
// del informe (valoresUnicos ya es genérica, se reusa tal cual).
export function opcionesZonaInformeIncidencias() {
    return valoresUnicos("incidencias", "zona");
}

export function opcionesTipoInformeIncidencias() {
    return valoresUnicos("incidencias", "tipo");
}

// Compara por la parte de fecha (YYYY-MM-DD) del dato crudo de MySQL -- ese
// formato ya ordena bien como texto, no hace falta parsear a Date ni
// preocuparse por huso horario.
function fechaIncidenciaDentroDeRango(incidencia, desde, hasta) {
    if (!incidencia._fechaReporteCruda) return false;
    const fechaIso = String(incidencia._fechaReporteCruda).slice(0, 10);
    if (desde && fechaIso < desde) return false;
    if (hasta && fechaIso > hasta) return false;
    return true;
}

// Arma el informe: totales por estado + el listado de incidencias que caen
// en el rango y los filtros pedidos (zona/tipo, iguales que los del módulo
// Incidencias). Sin "desde"/"hasta" no filtra por fecha (informe de todo el
// historial cargado).
export function generarInformeIncidencias({ desde = "", hasta = "", zona = "", tipo = "" } = {}) {
    const filas = datos.incidencias.filter((incidencia) => {
        if (!fechaIncidenciaDentroDeRango(incidencia, desde, hasta)) return false;
        if (zona && incidencia.zona !== zona) return false;
        if (tipo && incidencia.tipo !== tipo) return false;
        return true;
    });

    // Mismo criterio de estado EFECTIVO que distribucionIncidenciasPorEstado/
    // contarIncidenciasAbiertas: una "abierta" con cuadrilla ya asignada
    // cuenta como "en curso" acá (pedido de Matías, 15/10) -- el filtro de
    // zona/tipo/fecha de arriba no cambia, solo cómo se bucketiza el estado.
    return {
        total: filas.length,
        abiertas: filas.filter((f) => estadoEfectivoIncidencia(f) === "abierta").length,
        enCurso: filas.filter((f) => estadoEfectivoIncidencia(f) === "en curso").length,
        resueltas: filas.filter((f) => estadoEfectivoIncidencia(f) === "resuelta").length,
        porEstado: configuracionModulos.incidencias.estados.map((categoria) => ({
            categoria,
            cantidad: filas.filter((f) => estadoEfectivoIncidencia(f) === categoria).length
        })),
        // Copia (no se muta el objeto original de datos.incidencias, que
        // también usa el módulo Incidencias) con el estado efectivo aparte,
        // para que la columna "Estado" de la tabla del Informe sea coherente
        // con las tarjetas/gráfico de arriba (ambos ya usan el efectivo).
        filas: [...filas].sort((a, b) => Number(b.id) - Number(a.id)).map((f) => ({ ...f, _estadoEfectivo: estadoEfectivoIncidencia(f) }))
    };
}

// Columnas fijas del informe (menos campos que el export genérico de
// Incidencias -- acá interesa el resumen, no cada detalle administrativo).
const COLUMNAS_INFORME_INCIDENCIAS = [
    { campo: "id", etiqueta: "ID" },
    { campo: "fecha", etiqueta: "Fecha" },
    { campo: "tipo", etiqueta: "Tipo" },
    { campo: "zona", etiqueta: "Zona" },
    // _estadoEfectivo (no el "estado" literal) para que el Excel exportado
    // coincida con lo que se ve en pantalla (tarjetas/gráfico/tabla del
    // Informe, que ya usan el efectivo -- ver estadoEfectivoIncidencia).
    { campo: "_estadoEfectivo", etiqueta: "Estado" },
    { campo: "contenedor", etiqueta: "Contenedor asociado" },
    { campo: "resolucion", etiqueta: "Qué se hizo para resolverla", valorVacio: "Sin resolver todavía" }
];

// Exporta SIEMPRE todas las filas que matchean el informe (no solo las que
// se muestran en la tabla en pantalla, que se recorta por prolijidad).
export function filasInformeIncidenciasParaExportar(filas) {
    const encabezados = COLUMNAS_INFORME_INCIDENCIAS.map((columna) => columna.etiqueta);
    const filasExport = filas.map((registro) =>
        COLUMNAS_INFORME_INCIDENCIAS.map((columna) => {
            const valor = registro[columna.campo];
            if (valor === null || valor === undefined || valor === "") {
                return columna.valorVacio !== undefined ? columna.valorVacio : "";
            }
            return String(valor);
        })
    );
    return { encabezados, filas: filasExport };
}
