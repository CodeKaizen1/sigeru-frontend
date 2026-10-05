// Modelo: capa adaptadora async contra las 3 APIs reales (api-usuarios,
// api-gestion, api-recoleccion). Expone las mismas funciones y campos que
// antes usaba view.js/controller.js, así que quien llama no cambió.
// Los ids que salen de acá siempre son string. El id de "funcionario" es
// la cédula (no idOperarioDeCuadrilla); notificaciones y el texto de
// resolución de incidencias no tienen backend real todavía y quedan stub.

const API_USUARIOS = "../api-usuarios/index.php";
const API_GESTION = "../api-gestion/index.php";
const API_RECOLECCION = "../api-recoleccion/index.php";

async function llamarApi(base, recurso, metodo = "GET", cuerpo, id) {
    let url = `${base}?recurso=${recurso}`;
    if (id !== undefined && id !== null && id !== "") {
        url += `&id=${encodeURIComponent(id)}`;
    }

    const opciones = { method: metodo, credentials: "same-origin" };
    if (cuerpo !== undefined) {
        opciones.headers = { "Content-Type": "application/json" };
        opciones.body = JSON.stringify(cuerpo);
    }

    let respuesta;
    try {
        respuesta = await fetch(url, opciones);
    } catch (error) {
        return { ok: false, status: 0, datos: null };
    }

    const datosRespuesta = await respuesta.json().catch(() => null);
    return { ok: respuesta.ok, status: respuesta.status, datos: datosRespuesta };
}

function llamarUsuarios(recurso, metodo, cuerpo, id) {
    return llamarApi(API_USUARIOS, recurso, metodo, cuerpo, id);
}
function llamarGestion(recurso, metodo, cuerpo, id) {
    return llamarApi(API_GESTION, recurso, metodo, cuerpo, id);
}
function llamarRecoleccion(recurso, metodo, cuerpo, id) {
    return llamarApi(API_RECOLECCION, recurso, metodo, cuerpo, id);
}

// Traduce entre la clave de rol del login y la etiqueta que muestra la UI.
const ROLES_CUENTA_A_LABEL = {
    administrador: "Administrador",
    chofer: "Chofer",
    jefeDeCuadrilla: "Jefe de Cuadrilla",
    operarioDeCuadrilla: "Operario de cuadrilla"
};
const ROLES_LABEL_A_CUENTA = {
    "Administrador": "administrador",
    "Chofer": "chofer",
    "Jefe de Cuadrilla": "jefeDeCuadrilla",
    "Operario de cuadrilla": "operarioDeCuadrilla"
};
const ROLES_FUNCIONARIO_OPCIONES = ["Chofer", "Jefe de Cuadrilla", "Operario de cuadrilla", "Administrador"];

// Caché en memoria de todos los módulos. Se llena con recargarDatos() y
// el resto del archivo la lee/muta en el lugar, nunca la reasigna.
export const datos = {
    incidencias: [],
    contenedores: [],
    camiones: [],
    cuadrillas: [],
    rutas: [],
    centrosDeAcopio: [],
    vertederos: [],
    maquinaria: [],
    funcionarios: [],
    solicitudesPendientes: [],
    solicitudesRechazadas: [],
    notificaciones: []
};

// Mapas cédula <-> idOperarioDeCuadrilla, llenados por cargarOperariosCuadrilla().
let _operariosPorCedula = new Map();
let _operariosPorIdOperario = new Map();

async function cargarOperariosCuadrilla() {
    const { ok, datos: filas } = await llamarUsuarios("operarioDeCuadrilla", "GET");
    if (!ok || !Array.isArray(filas)) return;

    _operariosPorCedula = new Map();
    _operariosPorIdOperario = new Map();

    filas.forEach((fila) => {
        _operariosPorCedula.set(String(fila.cedulaUsuario), fila);
        _operariosPorIdOperario.set(String(fila.idOperarioDeCuadrilla), fila);
    });
}

async function idOperarioDesdeCedula(cedula) {
    if (!cedula) return null;
    if (_operariosPorCedula.size === 0) await cargarOperariosCuadrilla();
    const fila = _operariosPorCedula.get(String(cedula));
    return fila ? fila.idOperarioDeCuadrilla : null;
}

// Recarga todos los módulos desde el servidor.
export async function recargarDatos() {
    await cargarContenedores();
    await cargarIncidencias();
    recomputarResumenIncidenciasEnContenedores();
    await cargarOperariosCuadrilla();
    await Promise.all([cargarFuncionarios(), cargarCuadrillas(), cargarCamiones(), cargarRutas()]);
    await Promise.all([cargarCentrosDeAcopio(), cargarVertederos(), cargarMaquinaria()]);
    await cargarSolicitudes();
}

// Pide de nuevo al servidor los módulos (y sus joins) que necesita "modulo" para pintarse.
async function asegurarCargado(modulo) {
    if (modulo === "incidencias" || modulo === "contenedores") {
        await cargarContenedores();
        await cargarIncidencias();
        recomputarResumenIncidenciasEnContenedores();
        return;
    }

    if (modulo === "camiones") {
        await cargarOperariosCuadrilla();
        await Promise.all([cargarCamiones(), cargarFuncionarios(), cargarCuadrillas()]);
        return;
    }

    if (modulo === "cuadrillas") {
        await cargarOperariosCuadrilla();
        await Promise.all([cargarCuadrillas(), cargarFuncionarios(), cargarRutas(), cargarCamiones()]);
        await cargarContenedores();
        await cargarIncidencias();
        recomputarResumenIncidenciasEnContenedores();
        return;
    }

    if (modulo === "rutas") {
        await cargarOperariosCuadrilla();
        await Promise.all([cargarRutas(), cargarCuadrillas(), cargarFuncionarios()]);
        return;
    }

    if (modulo === "centrosDeAcopio") {
        await cargarCentrosDeAcopio();
        await cargarMaquinaria();
        return;
    }

    if (modulo === "vertederos") {
        await cargarVertederos();
        await cargarMaquinaria();
        return;
    }

    if (modulo === "funcionarios") {
        await cargarOperariosCuadrilla();
        await cargarFuncionarios();
        return;
    }

    if (modulo === "solicitudes") {
        await cargarSolicitudes();
        return;
    }

    if (modulo === "resumen") {
        await cargarContenedores();
        await cargarIncidencias();
        recomputarResumenIncidenciasEnContenedores();
        await cargarOperariosCuadrilla();
        await cargarFuncionarios();
        return;
    }
}

function formatearFechaCorta(fechaMysql) {
    if (!fechaMysql) return "";
    const fecha = new Date(String(fechaMysql).replace(" ", "T"));
    if (isNaN(fecha.getTime())) return "";
    return fecha.toLocaleDateString("es-UY");
}

// Convierte a número (parseFloat, ignora texto sobrante como "1100 litros"), o null si está vacío.
function aNumeroONull(valor) {
    if (valor === null || valor === undefined || valor === "") return null;
    const numero = parseFloat(valor);
    return isNaN(numero) ? null : numero;
}

function aEnteroONull(valor) {
    if (valor === null || valor === undefined || valor === "") return null;
    const numero = parseInt(valor, 10);
    return isNaN(numero) ? null : numero;
}

function fechaHoraParaMySQL(fecha) {
    const dosDigitos = (n) => String(n).padStart(2, "0");
    return `${fecha.getFullYear()}-${dosDigitos(fecha.getMonth() + 1)}-${dosDigitos(fecha.getDate())} ${dosDigitos(fecha.getHours())}:${dosDigitos(fecha.getMinutes())}:${dosDigitos(fecha.getSeconds())}`;
}

//
// Contenedores + Incidencias (api-gestion)
//

let _cacheContenedoresPorId = new Map();

async function cargarContenedores() {
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

function recomputarResumenIncidenciasEnContenedores() {
    datos.contenedores.forEach((c) => {
        c.incidencias = calcularResumenIncidenciasContenedor(c.id);
    });
}

async function cargarIncidencias() {
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
            // No se persisten en la base real: se pierden al recargar la página.
            resolucion: null,
            fechaResolucion: null,
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
            : (incidencia.cuadrillaId !== null ? Number(incidencia.cuadrillaId) : null)
    };
}

// Cambia el estado de una incidencia. Al pasar a "resuelta" exige el detalle de resolución (devuelve "RESOLUCION_REQUERIDA" si falta).
export async function cambiarEstadoIncidencia(idIncidencia, nuevoEstado, resolucionDetalle = "") {
    const incidencia = obtenerRegistroPorId("incidencias", idIncidencia);
    if (!incidencia) return null;

    let resolucion = null;
    let fechaResolucion = null;

    if (nuevoEstado === "resuelta") {
        const detalle = (resolucionDetalle || "").trim();
        if (!detalle) return "RESOLUCION_REQUERIDA";
        resolucion = detalle;
        fechaResolucion = new Date().toISOString();
    }

    const { ok } = await llamarGestion("incidencia", "PUT", cuerpoIncidencia(incidencia, { estadoIncidencia: nuevoEstado }), idIncidencia);
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

// Crea una incidencia reportada por el Jefe de Cuadrilla para su propia cuadrilla.
export async function crearIncidenciaDesdeCuadrilla(idCuadrilla, { tipo, descripcion }) {
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
        idContenedor: null,
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

export function contarIncidenciasAbiertas() {
    return datos.incidencias.filter((incidencia) => incidencia.estado === "abierta").length;
}

//
// Camiones + Cuadrillas + Rutas (api-recoleccion)
//

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

export function obtenerOperariosDisponibles() {
    return datos.funcionarios.filter((f) => f.rol === "Operario de cuadrilla" && f.estado === "activo");
}

export function obtenerJefesDisponibles() {
    return datos.funcionarios.filter((f) => f.rol === "Jefe de Cuadrilla" && f.estado === "activo");
}

export function obtenerChoferesDisponibles() {
    return datos.funcionarios.filter((f) => f.rol === "Chofer" && f.estado === "activo");
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

export function opcionesCuadrillaParaAsignar() {
    return [{ value: "", label: "Sin asignar" }].concat(
        datos.cuadrillas.map((cuadrilla) => {
            const ruta = datos.rutas.find((item) => item.id === cuadrilla.rutaId);
            const etiquetaZona = ruta ? ` — ${ruta.zona}` : "";
            return { value: cuadrilla.id, label: `${cuadrilla.id}${etiquetaZona}` };
        })
    );
}

export function opcionesRutasParaAsignar() {
    return [{ value: "", label: "Sin asignar" }].concat(
        datos.rutas.map((ruta) => ({ value: ruta.id, label: `${ruta.zona} — ${ruta.horario}` }))
    );
}

export function opcionesChoferParaCamion() {
    return [{ value: "", label: "Sin asignar" }].concat(
        obtenerChoferesDisponibles().map((f) => ({ value: f.id, label: `${f.nombre} ${f.apellido}` }))
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

    datos.rutas = filas.map((fila) => ({
        id: String(fila.idRuta),
        zona: fila.zonaRuta || "",
        recorrido: fila.recorridoRuta || "",
        frecuencia: fila.frecuenciaDeRecoleccionRuta || "",
        horario: fila.horarioRuta || "",
        estado: fila.estadoRuta || "sin iniciar",
        horaInicioReal: fila.horaInicioRealRuta || null,
        horaFinReal: fila.horaFinRealRuta || null,
        estadoAdmin: fila.estadoAdminRuta || "activa"
    }));
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
        estadoAdminRuta: ruta.estadoAdmin
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

//
// Centros de acopio / Vertederos / Maquinaria (api-gestion)
//

function mapearInstalacion(fila) {
    return {
        id: String(fila.idInstalacion),
        nombre: fila.nombreInstalacion || "",
        ubicacion: fila.ubicacionInstalacion || "",
        capacidad: fila.capacidadInstalacion || "",
        estado: fila.estadoOperativoInstalacion || ""
    };
}

async function cargarCentrosDeAcopio() {
    const { ok, datos: filas } = await llamarGestion("centroDeAcopio", "GET");
    if (!ok || !Array.isArray(filas)) return;
    datos.centrosDeAcopio = filas.map(mapearInstalacion);
}

async function cargarVertederos() {
    const { ok, datos: filas } = await llamarGestion("vertedero", "GET");
    if (!ok || !Array.isArray(filas)) return;
    datos.vertederos = filas.map(mapearInstalacion);
}

async function persistirInstalacion(modulo, registro) {
    const recurso = modulo === "centrosDeAcopio" ? "centroDeAcopio" : "vertedero";
    const camposPropios = modulo === "centrosDeAcopio"
        ? { clasificacionDeResiduoCentroDeAcopio: null, capacidadCentroDeAcopio: null }
        : { vidaUtil: null, tipoDeDispocicionVertedero: null };

    const { ok } = await llamarGestion(recurso, "PUT", {
        idInstalacion: Number(registro.id),
        nombreInstalacion: registro.nombre,
        ubicacionInstalacion: registro.ubicacion,
        capacidadInstalacion: aNumeroONull(registro.capacidad),
        estadoOperativoInstalacion: registro.estado,
        tipoResiduoInstalacion: null,
        latitudInstalacion: null,
        longitudInstalacion: null,
        ...camposPropios
    }, registro.id);

    return ok;
}

async function cargarMaquinaria() {
    const { ok, datos: filas } = await llamarGestion("maquinaria", "GET");
    if (!ok || !Array.isArray(filas)) return;

    datos.maquinaria = filas.map((fila) => ({
        id: String(fila.idMaquinaria),
        tipo: fila.tipoDeMaquinaria || "",
        estado: fila.estadoMaquinaria || "funcionando",
        instalacionId: fila.idInstalacion != null ? String(fila.idInstalacion) : null
    }));
}

export function obtenerMaquinariaDeInstalacion(idInstalacion) {
    return datos.maquinaria.filter((maquina) => maquina.instalacionId === idInstalacion);
}

export async function agregarMaquinaria(idInstalacion, tipo) {
    const { ok } = await llamarGestion("maquinaria", "POST", {
        idMaquinaria: null,
        tipoDeMaquinaria: tipo,
        estadoMaquinaria: "funcionando",
        disponibilidadMaquinaria: null,
        idInstalacion: Number(idInstalacion)
    });
    if (!ok) return null;

    await cargarMaquinaria();
    const propias = obtenerMaquinariaDeInstalacion(String(idInstalacion));
    return propias[propias.length - 1] || null;
}

export async function cambiarEstadoMaquinaria(idMaquinaria, estado) {
    const maquina = datos.maquinaria.find((item) => item.id === String(idMaquinaria));
    if (!maquina) return null;

    const { ok } = await llamarGestion("maquinaria", "PUT", {
        idMaquinaria: Number(idMaquinaria),
        tipoDeMaquinaria: maquina.tipo,
        estadoMaquinaria: estado,
        disponibilidadMaquinaria: null,
        idInstalacion: maquina.instalacionId !== null ? Number(maquina.instalacionId) : null
    }, idMaquinaria);
    if (!ok) return null;

    maquina.estado = estado;
    return maquina;
}

export async function quitarMaquinaria(idMaquinaria) {
    const { ok } = await llamarGestion("maquinaria", "DELETE", undefined, idMaquinaria);
    if (ok) {
        datos.maquinaria = datos.maquinaria.filter((item) => item.id !== String(idMaquinaria));
    }
}

//
// Funcionarios + Solicitudes + Mi cuenta (api-usuarios)
//

async function cargarFuncionarios() {
    const { ok, datos: filas } = await llamarUsuarios("usuario", "GET");
    if (!ok || !Array.isArray(filas)) return;

    datos.funcionarios = filas.map((u) => ({
        id: String(u.cedulaUsuario),
        cedula: String(u.cedulaUsuario),
        nombre: u.nombreUsuario || "",
        apellido: u.apellidoUsuario || "",
        fechaNacimiento: u.fechaNacimientoUsuario || "",
        telefono: u.telefonoUsuario || "",
        direccion: u.calleUsuario || "",
        email: u.emailUsuario || "",
        rol: ROLES_CUENTA_A_LABEL[u.rolUsuario] || u.rolUsuario,
        estado: u.estadoUsuario || "activo"
    }));
}

export function nombreFuncionario(id) {
    const funcionario = datos.funcionarios.find((item) => item.id === id);
    return funcionario ? `${funcionario.nombre} ${funcionario.apellido}` : null;
}

export function contarFuncionariosActivos() {
    return datos.funcionarios.filter((funcionario) => funcionario.estado === "activo").length;
}

async function guardarUsuario(registro) {
    const rolReal = ROLES_LABEL_A_CUENTA[registro.rol] || registro.rol;

    const { ok } = await llamarUsuarios("usuario", "PUT", {
        cedulaUsuario: registro.cedula,
        nombreUsuario: registro.nombre,
        apellidoUsuario: registro.apellido,
        calleUsuario: registro.direccion || null,
        numeroPuertaUsuario: null,
        numeroApartamentoUsuario: null,
        emailUsuario: registro.email || null,
        telefonoUsuario: registro.telefono || null,
        fechaNacimientoUsuario: registro.fechaNacimiento || null,
        estadoUsuario: registro.estado,
        rolUsuario: rolReal
    }, registro.cedula);

    return ok;
}

// Actualiza el "cargo" en operarioDeCuadrilla si el rol nuevo es Chofer/Jefe/Operario.
// No soporta pasar hacia o desde Administrador (tablas distintas).
async function actualizarCargoSiCorresponde(cedula, rolLabelNuevo) {
    const rolReal = ROLES_LABEL_A_CUENTA[rolLabelNuevo];
    const esRolOperario = ["chofer", "jefeDeCuadrilla", "operarioDeCuadrilla"].includes(rolReal);
    const operario = _operariosPorCedula.get(String(cedula));

    if (!operario || !esRolOperario) return;

    await llamarUsuarios("operarioDeCuadrilla", "PUT", {
        idOperarioDeCuadrilla: operario.idOperarioDeCuadrilla,
        cedulaUsuario: operario.cedulaUsuario,
        estadoOperarioDeCuadrilla: operario.estadoOperarioDeCuadrilla,
        cargoOperarioDeCuadrilla: rolReal,
        turnoOperarioDeCuadrilla: operario.turnoOperarioDeCuadrilla,
        horaInicioOperarioDeCuadrilla: operario.horaInicioOperarioDeCuadrilla,
        horaFinOperarioDeCuadrilla: operario.horaFinOperarioDeCuadrilla,
        licenciaDeConducirOperarioDeCuadrilla: operario.licenciaDeConducirOperarioDeCuadrilla,
        idCuadrilla: operario.idCuadrilla
    }, operario.idOperarioDeCuadrilla);

    await cargarOperariosCuadrilla();
}

async function cargarSolicitudes() {
    const { ok, datos: filas } = await llamarUsuarios("solicitudDeUsuario", "GET");
    if (!ok || !Array.isArray(filas)) return;

    const mapear = (fila) => ({
        id: String(fila.idSolicitud),
        nombre: fila.nombreUsuario || "",
        apellido: fila.apellidoUsuario || "",
        cedula: fila.cedulaUsuario || "",
        fechaNacimiento: fila.fechaNacimientoUsuario || "",
        telefono: fila.telefonoUsuario || "",
        direccion: fila.direccionCompletaUsuario || "",
        email: fila.emailUsuario || "",
        rolSolicitado: fila.rolSolicitado ? (ROLES_CUENTA_A_LABEL[fila.rolSolicitado] || fila.rolSolicitado) : null,
        fechaSolicitud: fila.fechaSolicitud || null,
        fechaRechazo: fila.fechaRechazo || null,
        motivoRechazo: fila.motivoRechazo || null,
        _crudo: fila
    });

    datos.solicitudesPendientes = filas.filter((f) => (f.estadoSolicitud || "pendiente") === "pendiente").map(mapear);
    datos.solicitudesRechazadas = filas.filter((f) => f.estadoSolicitud === "rechazada").map(mapear);
}

export async function obtenerSolicitudesPendientes() {
    await cargarSolicitudes();
    return datos.solicitudesPendientes;
}

export async function aprobarSolicitud(idSolicitud, rolLabel) {
    const rolReal = ROLES_LABEL_A_CUENTA[rolLabel] || rolLabel;

    const { ok, datos: respuesta } = await llamarUsuarios("aprobarSolicitud", "POST", {
        idSolicitud: Number(idSolicitud),
        rolUsuario: rolReal
    });

    if (!ok || !respuesta || !respuesta.exito) return null;

    await Promise.all([cargarSolicitudes(), cargarOperariosCuadrilla()]);
    await cargarFuncionarios();
    return obtenerRegistroPorId("funcionarios", String(respuesta.cedulaUsuario));
}

export async function rechazarSolicitud(idSolicitud) {
    const solicitud = datos.solicitudesPendientes.find((s) => s.id === String(idSolicitud));
    if (!solicitud || !solicitud._crudo) return null;

    const fila = solicitud._crudo;

    const { ok } = await llamarUsuarios("solicitudDeUsuario", "PUT", {
        idSolicitud: Number(idSolicitud),
        cedulaUsuario: fila.cedulaUsuario,
        nombreUsuario: fila.nombreUsuario,
        apellidoUsuario: fila.apellidoUsuario,
        direccionCompletaUsuario: fila.direccionCompletaUsuario,
        emailUsuario: fila.emailUsuario,
        telefonoUsuario: fila.telefonoUsuario,
        fechaNacimientoUsuario: fila.fechaNacimientoUsuario,
        contraseniaSolicitud: fila.contraseniaSolicitud,
        rolSolicitado: fila.rolSolicitado,
        estadoSolicitud: "rechazada",
        motivoRechazo: null,
        fechaRechazo: new Date().toLocaleDateString("es-UY")
    }, idSolicitud);

    if (!ok) return null;

    await cargarSolicitudes();
    return datos.solicitudesRechazadas.find((s) => s.id === String(idSolicitud)) || null;
}

//
// Mi cuenta
//

export const usuarioActual = (() => {
    const guardado = sessionStorage.getItem("sigeru_sesion_v1");
    if (!guardado) return null;

    try {
        return JSON.parse(guardado);
    } catch {
        return null;
    }
})();

export async function obtenerPerfilPropio() {
    if (!usuarioActual) return null;

    const { ok, datos: fila } = await llamarUsuarios("usuario", "GET", undefined, usuarioActual.cedulaUsuario);
    if (!ok || !fila) return null;

    return {
        nombre: fila.nombreUsuario || "",
        apellido: fila.apellidoUsuario || "",
        rol: ROLES_CUENTA_A_LABEL[fila.rolUsuario] || fila.rolUsuario,
        email: fila.emailUsuario || "",
        telefono: fila.telefonoUsuario || ""
    };
}

// Actualiza email/teléfono y opcionalmente la contraseña del usuario logueado.
export async function actualizarCuentaPropia({ email, telefono, contrasenaActual, contrasenaNueva }) {
    if (!usuarioActual) return null;

    const { ok: okGet, datos: filaActual } = await llamarUsuarios("usuario", "GET", undefined, usuarioActual.cedulaUsuario);
    if (!okGet || !filaActual) return null;

    const emailNuevo = (email || "").trim();
    const cambiaEmail = Boolean(emailNuevo) && emailNuevo !== filaActual.emailUsuario;
    const cambiaPassword = Boolean(contrasenaNueva);
    const telefonoNuevo = typeof telefono === "string" ? telefono.trim() : (filaActual.telefonoUsuario || "");

    if (cambiaPassword) {
        const { ok, status } = await llamarUsuarios("cambiarPassword", "POST", {
            contraseniaActual: contrasenaActual,
            contraseniaNueva: contrasenaNueva
        });
        if (!ok) {
            return status === 403 ? "CONTRASENA_INCORRECTA" : null;
        }
    }

    if (cambiaEmail || telefonoNuevo !== (filaActual.telefonoUsuario || "")) {
        const { ok } = await llamarUsuarios("usuario", "PUT", {
            cedulaUsuario: filaActual.cedulaUsuario,
            nombreUsuario: filaActual.nombreUsuario,
            apellidoUsuario: filaActual.apellidoUsuario,
            calleUsuario: filaActual.calleUsuario,
            numeroPuertaUsuario: filaActual.numeroPuertaUsuario,
            numeroApartamentoUsuario: filaActual.numeroApartamentoUsuario,
            emailUsuario: cambiaEmail ? emailNuevo : filaActual.emailUsuario,
            telefonoUsuario: telefonoNuevo,
            fechaNacimientoUsuario: filaActual.fechaNacimientoUsuario,
            estadoUsuario: filaActual.estadoUsuario,
            rolUsuario: filaActual.rolUsuario
        }, filaActual.cedulaUsuario);

        if (!ok) return null;
    }

    const perfilFinal = await obtenerPerfilPropio();
    return {
        ...perfilFinal,
        cambioSesion: cambiaEmail || cambiaPassword
    };
}

//
// Notificaciones — sin backend todavía, quedan stub.
//

export function obtenerNotificacionesAdmin() {
    return [];
}

export function obtenerNotificacionesCuadrilla() {
    return [];
}

export function marcarNotificacionesLeidas() {
    // no-op
}

//
// Config de cada módulo (título, descripción, estados, filtros extra, columnas de exportación).
//
export const configuracionModulos = {
    resumen: {
        titulo: "Resumen general",
        descripcion: "Vista inicial del estado general del sistema.",
        estados: []
    },
    incidencias: {
        titulo: "Incidencias reportadas",
        descripcion: "Listado de reportes realizados por usuarios del sistema.",
        estados: ["abierta", "en curso", "resuelta"],
        filtrosExtra: [
            { campo: "tipo", etiqueta: "Tipo", todosLabel: "Todos los tipos", opciones: "dinamico" },
            { campo: "zona", etiqueta: "Zona", todosLabel: "Todas las zonas", opciones: "dinamico" }
        ],
        filtroFecha: "fecha",
        columnasExport: [
            { campo: "id", etiqueta: "ID" },
            { campo: "tipo", etiqueta: "Tipo" },
            { campo: "estado", etiqueta: "Estado" },
            { campo: "zona", etiqueta: "Zona" },
            { campo: "direccion", etiqueta: "Dirección", valorVacio: "Sin dirección" },
            { campo: "fecha", etiqueta: "Fecha" },
            { campo: "descripcion", etiqueta: "Descripción" },
            { campo: "contenedor", etiqueta: "Contenedor asociado" },
            { campo: "cuadrillaId", etiqueta: "Cuadrilla asignada", valorVacio: "Sin asignar" },
            { campo: "resolucion", etiqueta: "Qué se hizo para resolverla", valorVacio: "Sin resolver todavía" },
            { campo: "fechaResolucion", etiqueta: "Resuelta el", valorVacio: "Sin resolver todavía" }
        ]
    },
    contenedores: {
        titulo: "Contenedores",
        descripcion: "Listado de contenedores con estado y ubicación.",
        estados: ["funcional", "roto", "desbordado", "baja"],
        filtrosExtra: [
            { campo: "tipoResiduo", etiqueta: "Tipo de residuo", todosLabel: "Todos los tipos de residuo", opciones: ["Residuos mezclados", "Residuos reciclables", "Residuos orgánicos"] }
        ],
        columnasExport: [
            { campo: "id", etiqueta: "ID" },
            { campo: "estado", etiqueta: "Estado" },
            { campo: "ubicacion", etiqueta: "Ubicación", valorVacio: "En depósito (repuesto)" },
            { campo: "capacidad", etiqueta: "Capacidad" },
            { campo: "tipoResiduo", etiqueta: "Tipo de residuo" },
            { campo: "incidencias", etiqueta: "Incidencias asociadas" }
        ]
    },
    camiones: {
        titulo: "Camiones",
        descripcion: "Listado de camiones con estado operativo.",
        estados: ["disponible", "asignado", "mantenimiento", "baja"],
        filtrosExtra: [
            { campo: "marca", etiqueta: "Marca", todosLabel: "Todas las marcas", opciones: "dinamico" }
        ],
        columnasExport: [
            { campo: "id", etiqueta: "ID" },
            { campo: "matricula", etiqueta: "Matrícula" },
            { campo: "marca", etiqueta: "Marca" },
            { campo: "modelo", etiqueta: "Modelo" },
            { campo: "anio", etiqueta: "Año" },
            { campo: "estado", etiqueta: "Disponibilidad" },
            { campo: "mantenimiento", etiqueta: "Mantenimiento" },
            { campo: "capacidad", etiqueta: "Capacidad" },
            { campo: "_choferNombre", etiqueta: "Chofer asignado" },
            { campo: "_rutaResumen", etiqueta: "Ruta asignada" }
        ]
    },
    cuadrillas: {
        titulo: "Cuadrillas",
        descripcion: "Composición de cada cuadrilla: jefe, chofer, camión, operarios y ruta asignada.",
        estados: ["activa", "baja"],
        columnasExport: [
            { campo: "id", etiqueta: "ID" },
            { campo: "_jefeNombre", etiqueta: "Jefe de cuadrilla" },
            { campo: "_choferNombre", etiqueta: "Chofer" },
            { campo: "_operariosCantidad", etiqueta: "Cantidad de operarios" },
            { campo: "_rutaResumen", etiqueta: "Ruta asignada" },
            { campo: "estado", etiqueta: "Estado" }
        ]
    },
    rutas: {
        titulo: "Rutas",
        descripcion: "Recorridos de recolección: zona, frecuencia, horario y cuadrilla asignada.",
        estados: ["activa", "baja"],
        filtrosExtra: [
            { campo: "zona", etiqueta: "Zona", todosLabel: "Todas las zonas", opciones: "dinamico" },
            { campo: "frecuencia", etiqueta: "Frecuencia", todosLabel: "Todas las frecuencias", opciones: ["Diaria", "Día por medio", "Semanal"] }
        ],
        columnasExport: [
            { campo: "id", etiqueta: "ID" },
            { campo: "zona", etiqueta: "Zona" },
            { campo: "frecuencia", etiqueta: "Frecuencia" },
            { campo: "recorrido", etiqueta: "Recorrido" },
            { campo: "horario", etiqueta: "Horario" },
            { campo: "estadoAdmin", etiqueta: "Estado" },
            { campo: "estado", etiqueta: "Seguimiento del recorrido de hoy" },
            { campo: "_cuadrillaResumen", etiqueta: "Cuadrilla asignada" }
        ]
    },
    centrosDeAcopio: {
        titulo: "Centros de acopio",
        descripcion: "Instalaciones de acopio de residuos reciclables.",
        estados: ["operativo", "mantenimiento", "baja"]
    },
    vertederos: {
        titulo: "Vertederos",
        descripcion: "Instalaciones de disposición final de residuos.",
        estados: ["operativo", "mantenimiento", "baja"]
    },
    funcionarios: {
        titulo: "Funcionarios",
        descripcion: "Alta y baja de trabajadores con acceso al sistema.",
        estados: ["activo", "baja"],
        filtrosExtra: [
            { campo: "rol", etiqueta: "Rol", todosLabel: "Todos los roles", opciones: ROLES_FUNCIONARIO_OPCIONES }
        ],
        columnasExport: [
            { campo: "id", etiqueta: "ID" },
            { campo: "nombre", etiqueta: "Nombres" },
            { campo: "apellido", etiqueta: "Apellidos" },
            { campo: "cedula", etiqueta: "Cédula" },
            { campo: "fechaNacimiento", etiqueta: "Fecha de nacimiento" },
            { campo: "telefono", etiqueta: "Teléfono" },
            { campo: "direccion", etiqueta: "Dirección" },
            { campo: "email", etiqueta: "Correo" },
            { campo: "rol", etiqueta: "Rol" },
            { campo: "estado", etiqueta: "Estado" }
        ]
    },
    solicitudes: {
        titulo: "Solicitudes de usuarios",
        descripcion: "Cuentas creadas desde el registro público, pendientes de aprobación.",
        estados: []
    }
};

// Config de los formularios de alta (qué campos pedir por módulo).
export const formulariosAlta = {
    contenedores: {
        titulo: "Nuevo contenedor",
        tituloEdicion: "Editar contenedor",
        campos: [
            { nombre: "ubicacion", etiqueta: "Ubicación", tipo: "text", requerido: false, ancho: "completo", placeholder: "Ej: Av. Brasil y Bulevar España (dejalo vacío si es repuesto en depósito)" },
            { nombre: "capacidad", etiqueta: "Capacidad", tipo: "text", requerido: true, placeholder: "Ej: 1100 litros" },
            { nombre: "tipoResiduo", etiqueta: "Tipo de residuo", tipo: "select", requerido: true, opciones: ["Residuos mezclados", "Residuos reciclables", "Residuos orgánicos"] },
            { nombre: "estado", etiqueta: "Estado inicial", tipo: "select", requerido: true, opciones: ["funcional", "roto", "desbordado"] }
        ]
    },
    camiones: {
        titulo: "Nuevo camión",
        tituloEdicion: "Editar camión",
        campos: [
            { nombre: "matricula", etiqueta: "Matrícula", tipo: "text", requerido: true, placeholder: "Ej: SBC 1234" },
            { nombre: "marca", etiqueta: "Marca", tipo: "text", requerido: true, placeholder: "Ej: Mercedes-Benz" },
            { nombre: "modelo", etiqueta: "Modelo", tipo: "text", requerido: true, placeholder: "Ej: Actros 2729" },
            { nombre: "anio", etiqueta: "Año", tipo: "number", requerido: true, placeholder: "Ej: 2019" },
            { nombre: "capacidad", etiqueta: "Capacidad", tipo: "text", requerido: true, placeholder: "Ej: 8 toneladas" },
            { nombre: "mantenimiento", etiqueta: "Mantenimiento", tipo: "text", requerido: false, placeholder: "Ej: Sin mantenimiento pendiente" },
            { nombre: "estado", etiqueta: "Disponibilidad", tipo: "select", requerido: true, opciones: ["disponible", "asignado", "mantenimiento"] }
        ]
    },
    rutas: {
        titulo: "Nueva ruta",
        tituloEdicion: "Editar ruta",
        campos: [
            { nombre: "zona", etiqueta: "Zona / barrio", tipo: "text", requerido: true, ancho: "completo", placeholder: "Ej: Pocitos" },
            { nombre: "recorrido", etiqueta: "Recorrido", tipo: "text", requerido: true, ancho: "completo", placeholder: "Ej: Av. Brasil - Bulevar España - Rambla" },
            { nombre: "frecuencia", etiqueta: "Frecuencia", tipo: "select", requerido: true, opciones: ["Diaria", "Día por medio", "Semanal"] },
            { nombre: "horario", etiqueta: "Horario", tipo: "text", requerido: true, placeholder: "Ej: 08:00 a 14:00" }
        ]
    },
    centrosDeAcopio: {
        titulo: "Nuevo centro de acopio",
        tituloEdicion: "Editar centro de acopio",
        campos: [
            { nombre: "nombre", etiqueta: "Nombre", tipo: "text", requerido: true, ancho: "completo", placeholder: "Ej: Centro de Acopio Pocitos" },
            { nombre: "ubicacion", etiqueta: "Ubicación", tipo: "text", requerido: true, ancho: "completo" },
            { nombre: "capacidad", etiqueta: "Capacidad", tipo: "text", requerido: true, placeholder: "Ej: 50 toneladas/mes" },
            { nombre: "estado", etiqueta: "Estado", tipo: "select", requerido: true, opciones: ["operativo", "mantenimiento", "baja"] }
        ]
    },
    vertederos: {
        titulo: "Nuevo vertedero",
        tituloEdicion: "Editar vertedero",
        campos: [
            { nombre: "nombre", etiqueta: "Nombre", tipo: "text", requerido: true, ancho: "completo", placeholder: "Ej: Vertedero Municipal Felipe Cardoso" },
            { nombre: "ubicacion", etiqueta: "Ubicación", tipo: "text", requerido: true, ancho: "completo" },
            { nombre: "capacidad", etiqueta: "Capacidad", tipo: "text", requerido: true, placeholder: "Ej: 500 toneladas/mes" },
            { nombre: "estado", etiqueta: "Estado", tipo: "select", requerido: true, opciones: ["operativo", "mantenimiento", "baja"] }
        ]
    },
    // email/password arman la cuenta de acceso, en un solo pedido (recurso "crearFuncionario").
    funcionarios: {
        titulo: "Nuevo funcionario",
        campos: [
            { nombre: "nombre", etiqueta: "Nombres", tipo: "text", requerido: true },
            { nombre: "apellido", etiqueta: "Apellidos", tipo: "text", requerido: true },
            { nombre: "cedula", etiqueta: "Cédula de identidad", tipo: "text", requerido: true, placeholder: "Ej: 41234567" },
            { nombre: "fechaNacimiento", etiqueta: "Fecha de nacimiento", tipo: "date", requerido: true },
            { nombre: "telefono", etiqueta: "Teléfono", tipo: "tel", requerido: true },
            { nombre: "direccion", etiqueta: "Dirección", tipo: "text", requerido: true, ancho: "completo" },
            { nombre: "email", etiqueta: "Correo electrónico", tipo: "email", requerido: true, ancho: "completo", placeholder: "Se usa para iniciar sesión" },
            { nombre: "password", etiqueta: "Contraseña", tipo: "password", requerido: true, placeholder: "Contraseña inicial de la cuenta" },
            { nombre: "rol", etiqueta: "Rol", tipo: "select", requerido: true, opciones: ROLES_FUNCIONARIO_OPCIONES }
        ]
    }
};

export const configEdicionFuncionarios = {
    tituloEdicion: "Editar funcionario",
    campos: [
        { nombre: "nombre", etiqueta: "Nombres", tipo: "text", requerido: true },
        { nombre: "apellido", etiqueta: "Apellidos", tipo: "text", requerido: true },
        { nombre: "telefono", etiqueta: "Teléfono", tipo: "tel", requerido: true },
        { nombre: "direccion", etiqueta: "Dirección", tipo: "text", requerido: true, ancho: "completo" },
        { nombre: "rol", etiqueta: "Rol", tipo: "select", requerido: true, opciones: ROLES_FUNCIONARIO_OPCIONES }
    ]
};

export function obtenerConfigEdicion(modulo) {
    if (modulo === "incidencias") return null;
    if (modulo === "funcionarios") return configEdicionFuncionarios;
    if (modulo === "camiones") return configEdicionCamiones();
    return formulariosAlta[modulo] || null;
}

function campoChoferCamion() {
    return { nombre: "choferId", etiqueta: "Chofer asignado", tipo: "select", requerido: false, ancho: "completo", opciones: opcionesChoferParaCamion() };
}

function configAltaCamiones() {
    return {
        titulo: formulariosAlta.camiones.titulo,
        campos: [...formulariosAlta.camiones.campos, campoChoferCamion()]
    };
}

function configEdicionCamiones() {
    return {
        tituloEdicion: "Editar camión",
        campos: [...formulariosAlta.camiones.campos, campoChoferCamion()]
    };
}

export function obtenerConfigAlta(modulo) {
    if (modulo === "camiones") return configAltaCamiones();
    return formulariosAlta[modulo] || null;
}

//
// Lectura / filtrado (síncrono, lee `datos` ya cargado)
//

export function normalizarTexto(texto) {
    return texto.toString().toLowerCase();
}

function coleccion(modulo) {
    if (modulo === "solicitudes") return datos.solicitudesPendientes;
    return datos[modulo] || [];
}

// Recarga `modulo` (y sus joins) desde el servidor y devuelve la colección fresca.
export async function obtenerRegistros(modulo) {
    await asegurarCargado(modulo);
    return coleccion(modulo);
}

export function obtenerRegistroPorId(modulo, id) {
    return coleccion(modulo).find((item) => item.id === id);
}

function filasCuadrillas() {
    return datos.cuadrillas.map((cuadrilla) => ({
        ...cuadrilla,
        _jefeNombre: cuadrilla.jefeId ? (nombreFuncionario(cuadrilla.jefeId) || "Sin asignar") : "Sin asignar",
        _choferNombre: cuadrilla.choferId ? (nombreFuncionario(cuadrilla.choferId) || "Sin asignar") : "Sin asignar",
        _operariosCantidad: cuadrilla.operarios.length,
        _rutaResumen: (() => {
            const ruta = datos.rutas.find((r) => r.id === cuadrilla.rutaId);
            return ruta ? `${ruta.zona} (${ruta.horario})` : "Sin ruta asignada";
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
                ? `${cuadrilla.ruta.zona} (${cuadrilla.ruta.horario})`
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

function valoresUnicos(modulo, campo) {
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

//
// Alta / baja genérica (async - escribe en la API real)
//

export async function crearRegistro(modulo, valoresCampos) {
    if (modulo === "contenedores") {
        const { ok } = await llamarGestion("contenedor", "POST", {
            idContenedor: null,
            ubicacionContenedor: valoresCampos.ubicacion || null,
            estadoContenedor: valoresCampos.estado,
            capacidadContenedor: aNumeroONull(valoresCampos.capacidad),
            tipoResiduoContenedor: valoresCampos.tipoResiduo
        });
        if (!ok) return null;
        await cargarContenedores();
        recomputarResumenIncidenciasEnContenedores();
        return datos.contenedores[datos.contenedores.length - 1] || null;
    }

    if (modulo === "camiones") {
        const idChoferReal = valoresCampos.choferId ? await idOperarioDesdeCedula(valoresCampos.choferId) : null;
        const { ok } = await llamarRecoleccion("vehiculo", "POST", {
            idVehiculo: null,
            matriculaVehiculo: valoresCampos.matricula,
            marcaVehiculo: valoresCampos.marca,
            modeloVehiculo: valoresCampos.modelo,
            anioVehiculo: aEnteroONull(valoresCampos.anio),
            disponibilidadVehiculo: valoresCampos.estado,
            capacidadVehiculo: aNumeroONull(valoresCampos.capacidad),
            mantenimientoVehiculo: valoresCampos.mantenimiento || null,
            idChofer: idChoferReal
        });
        if (!ok) return null;

        if (idChoferReal) {
            const otros = datos.camiones.filter((c) => c.choferId === valoresCampos.choferId);
            for (const otro of otros) {
                otro.choferId = null;
                await guardarCamion(otro);
            }
        }

        await cargarCamiones();
        return datos.camiones[datos.camiones.length - 1] || null;
    }

    if (modulo === "rutas") {
        const { ok } = await llamarRecoleccion("ruta", "POST", {
            idRuta: null,
            zonaRuta: valoresCampos.zona,
            recorridoRuta: valoresCampos.recorrido,
            frecuenciaDeRecoleccionRuta: valoresCampos.frecuencia,
            horarioRuta: valoresCampos.horario,
            estadoRuta: "sin iniciar",
            horaInicioRealRuta: null,
            horaFinRealRuta: null,
            estadoAdminRuta: "activa"
        });
        if (!ok) return null;
        await cargarRutas();
        return datos.rutas[datos.rutas.length - 1] || null;
    }

    if (modulo === "centrosDeAcopio" || modulo === "vertederos") {
        const recurso = modulo === "centrosDeAcopio" ? "centroDeAcopio" : "vertedero";
        const camposPropios = modulo === "centrosDeAcopio"
            ? { clasificacionDeResiduoCentroDeAcopio: null, capacidadCentroDeAcopio: null }
            : { vidaUtil: null, tipoDeDispocicionVertedero: null };

        const { ok } = await llamarGestion(recurso, "POST", {
            idInstalacion: null,
            nombreInstalacion: valoresCampos.nombre,
            ubicacionInstalacion: valoresCampos.ubicacion,
            capacidadInstalacion: aNumeroONull(valoresCampos.capacidad),
            estadoOperativoInstalacion: valoresCampos.estado,
            tipoResiduoInstalacion: null,
            latitudInstalacion: null,
            longitudInstalacion: null,
            ...camposPropios
        });
        if (!ok) return null;

        if (modulo === "centrosDeAcopio") {
            await cargarCentrosDeAcopio();
            return datos.centrosDeAcopio[datos.centrosDeAcopio.length - 1] || null;
        }
        await cargarVertederos();
        return datos.vertederos[datos.vertederos.length - 1] || null;
    }

    if (modulo === "funcionarios") {
        await cargarFuncionarios();
        const emailNuevo = (valoresCampos.email || "").toLowerCase();
        if (datos.funcionarios.some((f) => f.email && f.email.toLowerCase() === emailNuevo)) {
            return "EMAIL_DUPLICADO";
        }

        const rolReal = ROLES_LABEL_A_CUENTA[valoresCampos.rol];
        if (!rolReal) return null;

        const { ok, status, datos: respuesta } = await llamarUsuarios("crearFuncionario", "POST", {
            cedulaUsuario: valoresCampos.cedula,
            nombreUsuario: valoresCampos.nombre,
            apellidoUsuario: valoresCampos.apellido,
            calleUsuario: valoresCampos.direccion || null,
            emailUsuario: valoresCampos.email || null,
            telefonoUsuario: valoresCampos.telefono || null,
            fechaNacimientoUsuario: valoresCampos.fechaNacimiento || null,
            rolUsuario: rolReal,
            contraseniaNueva: valoresCampos.password
        });

        if (!ok) {
            if (status === 400 && respuesta && /cédula/i.test(respuesta.error || "")) return "CEDULA_DUPLICADA";
            return null;
        }

        await Promise.all([cargarFuncionarios(), cargarOperariosCuadrilla()]);
        return obtenerRegistroPorId("funcionarios", String(respuesta.cedulaUsuario));
    }

    return null;
}

export async function editarRegistro(modulo, id, valoresCampos) {
    const registro = obtenerRegistroPorId(modulo, id);
    if (!registro) return null;

    const config = obtenerConfigEdicion(modulo);
    if (!config) return null;

    let ok = false;

    if (modulo === "contenedores") {
        ({ ok } = await llamarGestion("contenedor", "PUT", {
            idContenedor: Number(id),
            ubicacionContenedor: valoresCampos.ubicacion || null,
            estadoContenedor: valoresCampos.estado,
            capacidadContenedor: aNumeroONull(valoresCampos.capacidad),
            tipoResiduoContenedor: valoresCampos.tipoResiduo
        }, id));
    } else if (modulo === "camiones") {
        const choferIdCedula = valoresCampos.choferId || null;

        if (choferIdCedula) {
            const otros = datos.camiones.filter((c) => c.id !== id && c.choferId === choferIdCedula);
            for (const otro of otros) {
                otro.choferId = null;
                await guardarCamion(otro);
            }
        }

        const idChoferReal = choferIdCedula ? await idOperarioDesdeCedula(choferIdCedula) : null;
        ({ ok } = await llamarRecoleccion("vehiculo", "PUT", {
            idVehiculo: Number(id),
            matriculaVehiculo: valoresCampos.matricula,
            marcaVehiculo: valoresCampos.marca,
            modeloVehiculo: valoresCampos.modelo,
            anioVehiculo: aEnteroONull(valoresCampos.anio),
            disponibilidadVehiculo: valoresCampos.estado,
            capacidadVehiculo: aNumeroONull(valoresCampos.capacidad),
            mantenimientoVehiculo: valoresCampos.mantenimiento || null,
            idChofer: idChoferReal
        }, id));
    } else if (modulo === "funcionarios") {
        const rolReal = ROLES_LABEL_A_CUENTA[valoresCampos.rol] || registro.rol;

        ok = await guardarUsuario({
            cedula: registro.cedula,
            nombre: valoresCampos.nombre,
            apellido: valoresCampos.apellido,
            direccion: valoresCampos.direccion,
            email: registro.email,
            telefono: valoresCampos.telefono,
            fechaNacimiento: registro.fechaNacimiento,
            estado: registro.estado,
            rol: rolReal
        });

        if (ok) {
            await actualizarCargoSiCorresponde(registro.cedula, valoresCampos.rol);
        }
    }

    if (!ok) return null;

    config.campos.forEach((campo) => {
        registro[campo.nombre] = valoresCampos[campo.nombre];
    });

    if (modulo === "camiones" && "choferId" in valoresCampos) {
        registro.choferId = registro.choferId || null;
        if (registro.choferId) {
            datos.camiones.forEach((camion) => {
                if (camion.id !== registro.id && camion.choferId === registro.choferId) {
                    camion.choferId = null;
                }
            });
        }
    }

    return registro;
}

export async function alternarBaja(modulo, id) {
    const registro = obtenerRegistroPorId(modulo, id);
    if (!registro) return null;

    const campoEstado = modulo === "rutas" ? "estadoAdmin" : "estado";
    const estaDeBaja = registro[campoEstado] === "baja";

    if (!estaDeBaja && modulo === "camiones" && camionTieneRutaAsignada(id)) {
        return "RUTA_ASIGNADA";
    }

    const nuevoEstado = estaDeBaja
        ? (registro.estadoAnterior || configuracionModulos[modulo].estados[0])
        : "baja";

    let ok = false;

    if (modulo === "contenedores") {
        ({ ok } = await llamarGestion("contenedor", "PUT", {
            idContenedor: Number(id),
            ubicacionContenedor: registro.ubicacion || null,
            estadoContenedor: nuevoEstado,
            capacidadContenedor: aNumeroONull(registro.capacidad),
            tipoResiduoContenedor: registro.tipoResiduo
        }, id));
    } else if (modulo === "camiones") {
        ok = await guardarCamion({ ...registro, estado: nuevoEstado });
    } else if (modulo === "rutas") {
        ({ ok } = await llamarRecoleccion("ruta", "PUT", {
            idRuta: Number(id),
            zonaRuta: registro.zona,
            recorridoRuta: registro.recorrido,
            frecuenciaDeRecoleccionRuta: registro.frecuencia,
            horarioRuta: registro.horario,
            estadoRuta: registro.estado,
            horaInicioRealRuta: registro.horaInicioReal,
            horaFinRealRuta: registro.horaFinReal,
            estadoAdminRuta: nuevoEstado
        }, id));
    } else if (modulo === "centrosDeAcopio" || modulo === "vertederos") {
        ok = await persistirInstalacion(modulo, { ...registro, estado: nuevoEstado });
    } else if (modulo === "funcionarios") {
        ok = await guardarUsuario({ ...registro, estado: nuevoEstado });
    } else if (modulo === "cuadrillas") {
        ok = await guardarCuadrilla({ ...registro, estado: nuevoEstado });
    }

    if (!ok) return null;

    if (estaDeBaja) {
        delete registro.estadoAnterior;
    } else {
        registro.estadoAnterior = registro[campoEstado];
    }
    registro[campoEstado] = nuevoEstado;

    return registro;
}
