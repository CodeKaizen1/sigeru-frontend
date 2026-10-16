// Punto 27 de la Fase 4: Camiones + Cuadrillas + Rutas (api-recoleccion) --
// se mantienen juntos en un solo archivo porque en el model.js original
// también lo estaban (un mismo bloque: "// Camiones + Cuadrillas + Rutas
// (api-recoleccion)"), y porque las 3 cosas se cruzan todo el tiempo
// (detalleCuadrilla junta jefe/chofer/camión/ruta/operarios en un solo
// objeto).
import { datos, llamarRecoleccion, llamarUsuarios, obtenerRegistroPorId, aNumeroONull, aEnteroONull, fechaHoraParaMySQL, contarPorCategoria, idOperarioDesdeCedula, cargarOperariosCuadrilla, _operariosPorCedula, _operariosPorIdOperario } from "./estado.js";
import { nombreFuncionario } from "./funcionarios.js";

async function cargarCamiones() {
    const { ok, datos: filas } = await llamarRecoleccion("vehiculo", "GET");
    if (!ok || !Array.isArray(filas)) return;

    if (_operariosPorIdOperario.size === 0) await cargarOperariosCuadrilla();

    datos.camiones = filas.map((fila) => {
        const operario = fila.idChofer != null ? _operariosPorIdOperario.get(String(fila.idChofer)) : null;

        return {
            id: String(fila.idVehiculo),
            matricula: fila.matriculaVehiculo || "",
            marca: fila.marcaVehiculo || "",
            modelo: fila.modeloVehiculo || "",
            anio: fila.anioVehiculo || "",
            estado: fila.disponibilidadVehiculo || "",
            mantenimiento: fila.mantenimientoVehiculo || "",
            capacidad: fila.capacidadVehiculo || "",
            choferId: operario ? String(operario.cedulaUsuario) : null
        };
    });
}

async function guardarCamion(camion) {
    const idChoferReal = camion.choferId ? await idOperarioDesdeCedula(camion.choferId) : null;

    const { ok } = await llamarRecoleccion("vehiculo", "PUT", {
        idVehiculo: Number(camion.id),
        matriculaVehiculo: camion.matricula,
        marcaVehiculo: camion.marca,
        modeloVehiculo: camion.modelo,
        anioVehiculo: aEnteroONull(camion.anio),
        disponibilidadVehiculo: camion.estado,
        capacidadVehiculo: aNumeroONull(camion.capacidad),
        mantenimientoVehiculo: camion.mantenimiento || null,
        idChofer: idChoferReal
    }, camion.id);

    return ok;
}

export async function asignarChoferACamion(idCamion, idChoferCedula) {
    const camion = obtenerRegistroPorId("camiones", idCamion);
    if (!camion) return null;

    const cedula = idChoferCedula || null;

    if (cedula) {
        const otros = datos.camiones.filter((c) => c.id !== idCamion && c.choferId === cedula);
        for (const otro of otros) {
            otro.choferId = null;
            await guardarCamion(otro);
        }
    }

    camion.choferId = cedula;
    const ok = await guardarCamion(camion);
    if (!ok) return null;

    return camion;
}

async function cargarCuadrillas() {
    const { ok, datos: filas } = await llamarRecoleccion("cuadrilla", "GET");
    if (!ok || !Array.isArray(filas)) return;

    if (_operariosPorIdOperario.size === 0) await cargarOperariosCuadrilla();

    datos.cuadrillas = filas.map((fila) => {
        const jefe = fila.idJefeCuadrilla != null ? _operariosPorIdOperario.get(String(fila.idJefeCuadrilla)) : null;
        const chofer = fila.idChofer != null ? _operariosPorIdOperario.get(String(fila.idChofer)) : null;

        return {
            id: String(fila.idCuadrilla),
            nombre: fila.nombreCuadrilla || "",
            jefeId: jefe ? String(jefe.cedulaUsuario) : null,
            choferId: chofer ? String(chofer.cedulaUsuario) : null,
            operarios: obtenerCedulasOperariosDeCuadrilla(fila.idCuadrilla),
            rutaId: fila.idRuta != null ? String(fila.idRuta) : null,
            estado: fila.estadoCuadrilla || "activa"
        };
    });
}

// Cédulas de los operarios (no jefe/chofer) de una cuadrilla.
function obtenerCedulasOperariosDeCuadrilla(idCuadrilla) {
    const resultado = [];
    _operariosPorIdOperario.forEach((fila) => {
        if (fila.cargoOperarioDeCuadrilla === "operarioDeCuadrilla" && fila.idCuadrilla != null && String(fila.idCuadrilla) === String(idCuadrilla)) {
            resultado.push(String(fila.cedulaUsuario));
        }
    });
    return resultado;
}

async function guardarCuadrilla(cuadrilla) {
    const idJefeReal = cuadrilla.jefeId ? await idOperarioDesdeCedula(cuadrilla.jefeId) : null;
    const idChoferReal = cuadrilla.choferId ? await idOperarioDesdeCedula(cuadrilla.choferId) : null;

    const { ok } = await llamarRecoleccion("cuadrilla", "PUT", {
        idCuadrilla: Number(cuadrilla.id),
        nombreCuadrilla: cuadrilla.nombre || null,
        idChofer: idChoferReal,
        idJefeCuadrilla: idJefeReal,
        idVehiculo: null,
        idRuta: cuadrilla.rutaId ? Number(cuadrilla.rutaId) : null,
        estadoCuadrilla: cuadrilla.estado || "activa"
    }, cuadrilla.id);

    return ok;
}

export function obtenerCuadrillas() {
    return datos.cuadrillas;
}

export function obtenerCuadrillaPorId(id) {
    return datos.cuadrillas.find((item) => item.id === id);
}

export function detalleCuadrilla(idCuadrilla) {
    const cuadrilla = obtenerCuadrillaPorId(idCuadrilla);
    if (!cuadrilla) return null;

    const ruta = datos.rutas.find((item) => item.id === cuadrilla.rutaId);
    const camion = cuadrilla.choferId
        ? datos.camiones.find((item) => item.choferId === cuadrilla.choferId)
        : null;

    return {
        id: cuadrilla.id,
        jefe: cuadrilla.jefeId ? datos.funcionarios.find((f) => f.id === cuadrilla.jefeId) : null,
        chofer: cuadrilla.choferId ? datos.funcionarios.find((f) => f.id === cuadrilla.choferId) : null,
        camion: camion || null,
        operarios: cuadrilla.operarios.map((id) => datos.funcionarios.find((f) => f.id === id)).filter(Boolean),
        ruta: ruta || null,
        incidencias: datos.incidencias.filter((inc) => {
            if (inc.estado === "resuelta") return false;
            if (inc.cuadrillaId) return inc.cuadrillaId === cuadrilla.id;
            return ruta ? inc.zona === ruta.zona : false;
        })
    };
}

export function obtenerCuadrillaDeChofer(cedula) {
    const cuadrilla = datos.cuadrillas.find((item) => item.choferId === cedula);
    return cuadrilla ? detalleCuadrilla(cuadrilla.id) : null;
}

export function obtenerCuadrillaDeRuta(idRuta) {
    const cuadrilla = datos.cuadrillas.find((item) => item.rutaId === idRuta);
    return cuadrilla ? detalleCuadrilla(cuadrilla.id) : null;
}

export function obtenerCuadrillaDeJefe(cedula) {
    const cuadrilla = datos.cuadrillas.find((item) => item.jefeId === cedula);
    return cuadrilla ? detalleCuadrilla(cuadrilla.id) : null;
}

export function obtenerCuadrillaDeOperario(cedula) {
    const cuadrilla = datos.cuadrillas.find((item) => item.operarios.includes(cedula));
    return cuadrilla ? detalleCuadrilla(cuadrilla.id) : null;
}

// --- Conflictos de asignación (jefe/chofer/operario ya en OTRA cuadrilla) ---
// Antes, elegir en el formulario de cuadrilla a alguien que ya era jefe/chofer
// de otra, o tildar como operario a alguien que ya estaba en otra, lo sacaba
// de ahí en silencio. Estas funciones son de solo lectura (no modifican nada)
// para que el controller pueda preguntar antes de guardar.
function otraCuadrillaPorCampo(campo, cedula, idCuadrillaExcluir) {
    if (!cedula) return null;
    const cuadrilla = datos.cuadrillas.find((c) => c[campo] === cedula && String(c.id) !== String(idCuadrillaExcluir ?? ""));
    return cuadrilla ? { id: cuadrilla.id, nombre: cuadrilla.nombre || cuadrilla.id } : null;
}

function otraCuadrillaDeOperarioExcluyendo(cedula, idCuadrillaExcluir) {
    if (!cedula) return null;
    const cuadrilla = datos.cuadrillas.find((c) => c.operarios.includes(cedula) && String(c.id) !== String(idCuadrillaExcluir ?? ""));
    return cuadrilla ? { id: cuadrilla.id, nombre: cuadrilla.nombre || cuadrilla.id } : null;
}

// Cada una devuelve {id, nombre} de la OTRA cuadrilla (distinta de idCuadrillaExcluir)
// que ya tiene a esa persona, o null si está libre.
export function obtenerOtraCuadrillaDeJefe(cedula, idCuadrillaExcluir = null) {
    return otraCuadrillaPorCampo("jefeId", cedula, idCuadrillaExcluir);
}

export function obtenerOtraCuadrillaDeChofer(cedula, idCuadrillaExcluir = null) {
    return otraCuadrillaPorCampo("choferId", cedula, idCuadrillaExcluir);
}

export function obtenerOtraCuadrillaDeOperario(cedula, idCuadrillaExcluir = null) {
    return otraCuadrillaDeOperarioExcluyendo(cedula, idCuadrillaExcluir);
}

// El camión que ya conduce esa cédula (distinto de idCamionExcluir), o null.
// Independiente del chequeo de cuadrilla de arriba: el chofer de un camión y
// el chofer de una cuadrilla son campos separados que solo deberían coincidir
// por convención, no están forzados a ser iguales en la base.
export function obtenerOtroCamionDeChofer(cedula, idCamionExcluir = null) {
    if (!cedula) return null;
    return datos.camiones.find((c) => c.choferId === cedula && String(c.id) !== String(idCamionExcluir ?? "")) || null;
}

// Si se pasa idCuadrillaExcluir, cada funcionario devuelto trae además
// _otraCuadrilla: {id, nombre} si ya está en OTRA cuadrilla (o en cualquier
// cuadrilla, si no se pasa id) -- para que el formulario de alta/edición de
// cuadrillas pueda separar visualmente "sin cuadrilla" de "ya asignado a otra".
export function obtenerOperariosDisponibles(idCuadrillaExcluir = null) {
    return datos.funcionarios
        .filter((f) => f.rol === "Operario de cuadrilla" && f.estado === "activo")
        .map((f) => ({ ...f, _otraCuadrilla: otraCuadrillaDeOperarioExcluyendo(f.id, idCuadrillaExcluir) }));
}

export function obtenerJefesDisponibles(idCuadrillaExcluir = null) {
    return datos.funcionarios
        .filter((f) => f.rol === "Jefe de Cuadrilla" && f.estado === "activo")
        .map((f) => ({ ...f, _otraCuadrilla: otraCuadrillaPorCampo("jefeId", f.id, idCuadrillaExcluir) }));
}

export function obtenerChoferesDisponibles(idCuadrillaExcluir = null) {
    return datos.funcionarios
        .filter((f) => f.rol === "Chofer" && f.estado === "activo")
        .map((f) => ({ ...f, _otraCuadrilla: otraCuadrillaPorCampo("choferId", f.id, idCuadrillaExcluir) }));
}

export function obtenerOtrasCuadrillas(idCuadrillaActual) {
    return datos.cuadrillas.filter((c) => c.id !== idCuadrillaActual);
}

export function obtenerCamionesDisponibles() {
    return datos.camiones.filter((c) => c.estado !== "baja");
}

export function obtenerRutas() {
    return datos.rutas;
}

// Si se pasa zonaIncidencia, solo se ofrecen las cuadrillas cuya ruta
// coincide con esa zona (una incidencia de Punta Gorda no se le puede
// asignar a una cuadrilla que recorre Pocitos). Sin zonaIncidencia (o si
// ninguna cuadrilla coincide y así quedaría una lista vacía), se cae de
// nuevo a la lista completa en vez de dejar el selector sin opciones.
export function opcionesCuadrillaParaAsignar(zonaIncidencia) {
    const construirOpcion = (cuadrilla, ruta) => {
        const etiquetaZona = ruta ? ` — ${ruta.nombre || ruta.zona}` : "";
        const nombreJefe = cuadrilla.jefeId ? nombreFuncionario(cuadrilla.jefeId) : null;
        const etiquetaJefe = nombreJefe ? ` (jefe: ${nombreJefe})` : " (sin jefe asignado)";
        return { value: cuadrilla.id, label: `${cuadrilla.id}${etiquetaZona}${etiquetaJefe}` };
    };

    const cuadrillasConRuta = datos.cuadrillas.map((cuadrilla) => ({
        cuadrilla,
        ruta: datos.rutas.find((item) => item.id === cuadrilla.rutaId)
    }));

    let candidatas = cuadrillasConRuta;
    if (zonaIncidencia) {
        const coincidentes = cuadrillasConRuta.filter(({ ruta }) => ruta && ruta.zona === zonaIncidencia);
        if (coincidentes.length > 0) candidatas = coincidentes;
    }

    return [{ value: "", label: "Sin asignar" }].concat(
        candidatas.map(({ cuadrilla, ruta }) => construirOpcion(cuadrilla, ruta))
    );
}

export function opcionesRutasParaAsignar() {
    return [{ value: "", label: "Sin asignar" }].concat(
        datos.rutas.map((ruta) => ({ value: ruta.id, label: `${ruta.nombre || ruta.zona} — ${ruta.horario}` }))
    );
}

// Si se pasa idCamionExcluir (el camión que se está editando), no se marca
// como conflicto que el chofer ya conduzca ESE MISMO camión.
export function opcionesChoferParaCamion(idCamionExcluir = null) {
    return [{ value: "", label: "Sin asignar" }].concat(
        obtenerChoferesDisponibles().map((f) => {
            const otroCamion = obtenerOtroCamionDeChofer(f.id, idCamionExcluir);
            const etiquetaConflicto = otroCamion ? ` (ya conduce ${otroCamion.matricula || "otro camión"})` : "";
            return { value: f.id, label: `${f.nombre} ${f.apellido}${etiquetaConflicto}` };
        })
    );
}

async function asignarPersonaACuadrilla(idCuadrilla, cedula, tipo) {
    const cuadrilla = obtenerCuadrillaPorId(idCuadrilla);
    if (!cuadrilla) return null;

    const campo = tipo === "jefe" ? "jefeId" : "choferId";
    const cedulaNueva = cedula || null;

    if (cedulaNueva) {
        const otras = datos.cuadrillas.filter((c) => c.id !== idCuadrilla && c[campo] === cedulaNueva);
        for (const otra of otras) {
            otra[campo] = null;
            await guardarCuadrilla(otra);
        }
    }

    cuadrilla[campo] = cedulaNueva;
    const ok = await guardarCuadrilla(cuadrilla);
    if (!ok) return null;

    return cuadrilla;
}

export async function asignarJefeACuadrilla(idCuadrilla, idJefe) {
    return asignarPersonaACuadrilla(idCuadrilla, idJefe, "jefe");
}

export async function asignarChoferACuadrilla(idCuadrilla, idChofer) {
    return asignarPersonaACuadrilla(idCuadrilla, idChofer, "chofer");
}

export async function asignarRutaACuadrilla(idCuadrilla, idRuta) {
    const cuadrilla = obtenerCuadrillaPorId(idCuadrilla);
    if (!cuadrilla) return null;

    cuadrilla.rutaId = idRuta || null;
    const ok = await guardarCuadrilla(cuadrilla);
    if (!ok) return null;

    return cuadrilla;
}

export async function crearCuadrilla() {
    const { ok } = await llamarRecoleccion("cuadrilla", "POST", {
        idCuadrilla: null,
        nombreCuadrilla: `Cuadrilla ${datos.cuadrillas.length + 1}`,
        idChofer: null,
        idJefeCuadrilla: null,
        idVehiculo: null,
        idRuta: null,
        estadoCuadrilla: "activa"
    });
    if (!ok) return null;

    await cargarCuadrillas();
    return datos.cuadrillas[datos.cuadrillas.length - 1] || null;
}

export async function moverOperario(cedula, idCuadrillaDestino) {
    const operario = _operariosPorCedula.get(String(cedula));
    if (!operario) return null;

    const { ok } = await llamarUsuarios("operarioDeCuadrilla", "PUT", {
        idOperarioDeCuadrilla: operario.idOperarioDeCuadrilla,
        cedulaUsuario: operario.cedulaUsuario,
        estadoOperarioDeCuadrilla: operario.estadoOperarioDeCuadrilla,
        cargoOperarioDeCuadrilla: operario.cargoOperarioDeCuadrilla,
        turnoOperarioDeCuadrilla: operario.turnoOperarioDeCuadrilla,
        horaInicioOperarioDeCuadrilla: operario.horaInicioOperarioDeCuadrilla,
        horaFinOperarioDeCuadrilla: operario.horaFinOperarioDeCuadrilla,
        licenciaDeConducirOperarioDeCuadrilla: operario.licenciaDeConducirOperarioDeCuadrilla,
        idCuadrilla: idCuadrillaDestino ? Number(idCuadrillaDestino) : null
    }, operario.idOperarioDeCuadrilla);

    if (!ok) return null;

    await cargarOperariosCuadrilla();
    await cargarCuadrillas();
    return obtenerCuadrillaPorId(idCuadrillaDestino);
}

async function cargarRutas() {
    const { ok, datos: filas } = await llamarRecoleccion("ruta", "GET");
    if (!ok || !Array.isArray(filas)) return;

    // Municipio (14/10/2026, 01_code.sql seccion 12): ahora es una columna
    // propia (ruta.municipioRuta), completada sola al elegir el barrio en
    // "Nueva ruta" (ver crearRutaConContenedores). Las rutas viejas (de
    // antes de esta columna) pueden no tenerla todavia -- para esas, se
    // sigue derivando del texto de recorridoRuta como antes (los circuitos
    // reales de la IMM siempre traen "..., Municipio X)", ver
    // agregar_rutas_recoleccion.sql); una ruta cargada a mano sin ese
    // formato ni la columna simplemente queda sin municipio.
    const MUNICIPIO_DESDE_RECORRIDO = /,\s*Municipio\s+([A-Za-zÁÉÍÓÚÑ]+)\)/;

    datos.rutas = filas.map((fila) => {
        const matchMunicipio = (fila.recorridoRuta || "").match(MUNICIPIO_DESDE_RECORRIDO);
        return {
            id: String(fila.idRuta),
            // nombreRuta (ej. "Pocitos 3") identifica una ruta puntual cuando
            // su barrio tiene mas de una. OJO: a proposito NO cae de vuelta a
            // la zona aca (ese fallback se aplica solo al MOSTRARLO, en los
            // paneles de chofer/jefe/operario) -- si lo hiciera, guardarRuta()
            // reenviaria ese texto "de relleno" como si fuera el nombre real
            // guardado, y un jefe marcando inicio/fin de SU ruta (que solo
            // puede tocar estado/horaInicio/horaFin, ver Utilidades.php
            // soloCambianCamposPermitidos) se encontraria "cambiando" tambien
            // nombreRuta sin querer y el backend le rechazaria el guardado.
            nombre: fila.nombreRuta || "",
            zona: fila.zonaRuta || "",
            recorrido: fila.recorridoRuta || "",
            // Acá SÍ se puede caer de vuelta al derivado de recorridoRuta
            // (a diferencia de nombre arriba): guardarRuta() ya reenvía este
            // valor tal cual en cada PUT (ver más abajo), así que si una
            // ruta vieja no tiene la columna todavía, el primer guardado
            // (por ejemplo un jefe marcando inicio/fin) la completa sola con
            // el mismo valor que ya se mostraba -- no hay "relleno" que se
            // termine guardando como si fuera otra cosa.
            municipio: fila.municipioRuta || (matchMunicipio ? `Municipio ${matchMunicipio[1]}` : ""),
            frecuencia: fila.frecuenciaDeRecoleccionRuta || "",
            horario: fila.horarioRuta || "",
            estado: fila.estadoRuta || "sin iniciar",
            horaInicioReal: fila.horaInicioRealRuta || null,
            horaFinReal: fila.horaFinRealRuta || null,
            estadoAdmin: fila.estadoAdminRuta || "activa"
        };
    });
}

// Mismas 5 categorías del filtro "Frecuencia" de Rutas (ver configuracionModulos
// en config-modulos.js) -- se repite el literal porque ahí está anidado dentro
// de filtrosExtra, no vale la pena desarmarlo solo para reusarlo acá.
const FRECUENCIAS_RUTA = ["Diaria", "Interdiaria", "Semanal", "Irregular", "Sin datos"];

export function distribucionRutasPorFrecuencia() {
    return contarPorCategoria(datos.rutas, "frecuencia", FRECUENCIAS_RUTA);
}

async function guardarRuta(ruta) {
    const { ok } = await llamarRecoleccion("ruta", "PUT", {
        idRuta: Number(ruta.id),
        zonaRuta: ruta.zona,
        recorridoRuta: ruta.recorrido,
        frecuenciaDeRecoleccionRuta: ruta.frecuencia,
        horarioRuta: ruta.horario,
        estadoRuta: ruta.estado,
        horaInicioRealRuta: ruta.horaInicioReal,
        horaFinRealRuta: ruta.horaFinReal,
        estadoAdminRuta: ruta.estadoAdmin,
        // Importante: aunque esta funcion solo cambie estado/horaInicio/Fin
        // (marcar inicio/fin de ruta desde el panel del jefe), hay que
        // re-enviar nombreRuta/municipioRuta con su valor actual -- el
        // backend valida que un jefe de cuadrilla SOLO pueda tocar esos 3
        // campos comparando TODA la fila (soloCambianCamposPermitidos en
        // Utilidades.php), y si cualquiera de estos faltara en el body lo
        // interpretaria como "lo querés borrar" y rechazaria el guardado
        // con 403.
        nombreRuta: ruta.nombre,
        municipioRuta: ruta.municipio || null
    }, ruta.id);

    return ok;
}

async function marcarSeguimientoRuta(idRuta, cambios) {
    const ruta = datos.rutas.find((r) => r.id === String(idRuta));
    if (!ruta) return null;

    Object.assign(ruta, cambios);
    const ok = await guardarRuta(ruta);
    if (!ok) return null;

    return ruta;
}

export async function iniciarRuta(idRuta) {
    return marcarSeguimientoRuta(idRuta, { estado: "en curso", horaInicioReal: fechaHoraParaMySQL(new Date()), horaFinReal: null });
}

export async function finalizarRuta(idRuta) {
    return marcarSeguimientoRuta(idRuta, { estado: "finalizada", horaFinReal: fechaHoraParaMySQL(new Date()) });
}

export function camionTieneRutaAsignada(idCamion) {
    const camion = datos.camiones.find((item) => item.id === idCamion);
    if (!camion || !camion.choferId) return false;

    const cuadrilla = datos.cuadrillas.find((c) => c.choferId === camion.choferId);
    return Boolean(cuadrilla && cuadrilla.rutaId);
}

// --- funciones promovidas a export para que otros archivos de model/ (
// contenedores-incidencias.js, orquestacion-carga.js, crud-generico.js)
// puedan llamarlas -- en el model.js original no hacía falta "export"
// porque estaban en el mismo archivo que quien las llamaba. ---
export { cargarCamiones, guardarCamion, cargarCuadrillas, guardarCuadrilla, cargarRutas };
