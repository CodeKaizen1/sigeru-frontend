// Punto 27 de la Fase 4 (16/10/2026): model.js se separó en archivos propios
// por tema -- este es el único sin dependencias internas (no importa de
// ningún otro archivo de model/), la base sobre la que se apoyan todos los
// demás. model.js (en la carpeta de arriba) sigue siendo el único punto de
// import real para controller.js/panel-*.js -- no cambió nada ahí, solo
// quedó como un aggregator que reexporta desde esta carpeta.
//
// Qué vive acá: las 3 llamadas crudas a las APIs reales, los roles, la
// caché compartida en memoria ("datos", mutada por todos los demás
// archivos de model/) y utilidades genéricas sin estado propio
// (fechas/números, contar por categoría, normalizar texto) que varios
// archivos de model/ necesitan.

const API_USUARIOS = "../../api-usuarios/index.php";
const API_GESTION = "../../api-gestion/index.php";
const API_RECOLECCION = "../../api-recoleccion/index.php";

// paramsExtra: objeto con parámetros extra de query string (ej. destinatario/idCuadrilla
// para notificaciones), agregado para el punto 16 -- ningún llamado previo lo necesitaba.
async function llamarApi(base, recurso, metodo = "GET", cuerpo, id, paramsExtra) {
    let url = `${base}?recurso=${recurso}`;
    if (id !== undefined && id !== null && id !== "") {
        url += `&id=${encodeURIComponent(id)}`;
    }
    if (paramsExtra) {
        for (const [clave, valor] of Object.entries(paramsExtra)) {
            if (valor === undefined || valor === null || valor === "") continue;
            url += `&${clave}=${encodeURIComponent(valor)}`;
        }
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

export function llamarUsuarios(recurso, metodo, cuerpo, id, paramsExtra) {
    return llamarApi(API_USUARIOS, recurso, metodo, cuerpo, id, paramsExtra);
}
export function llamarGestion(recurso, metodo, cuerpo, id, paramsExtra) {
    return llamarApi(API_GESTION, recurso, metodo, cuerpo, id, paramsExtra);
}
export function llamarRecoleccion(recurso, metodo, cuerpo, id, paramsExtra) {
    return llamarApi(API_RECOLECCION, recurso, metodo, cuerpo, id, paramsExtra);
}

// Traduce entre la clave de rol del login y la etiqueta que muestra la UI.
export const ROLES_CUENTA_A_LABEL = {
    administrador: "Administrador",
    chofer: "Chofer",
    jefeDeCuadrilla: "Jefe de Cuadrilla",
    operarioDeCuadrilla: "Operario de cuadrilla"
};
export const ROLES_LABEL_A_CUENTA = {
    "Administrador": "administrador",
    "Chofer": "chofer",
    "Jefe de Cuadrilla": "jefeDeCuadrilla",
    "Operario de cuadrilla": "operarioDeCuadrilla"
};
export const ROLES_FUNCIONARIO_OPCIONES = ["Chofer", "Jefe de Cuadrilla", "Operario de cuadrilla", "Administrador"];

// Caché en memoria de todos los módulos. Se llena con recargarDatos() (en
// orquestacion-carga.js) y el resto de model/ la lee/muta en el lugar,
// nunca la reasigna.
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
// Export directo (no getters): al ser "let", otros archivos de model/ que
// hacen `import { _operariosPorCedula } from "./estado.js"` siempre ven el
// valor más reciente -- los módulos ES usan bindings vivos, no una copia
// del valor al momento del import, así que la reasignación de más abajo
// (cargarOperariosCuadrilla) se refleja sola en todos los que ya la importaron.
export let _operariosPorCedula = new Map();
export let _operariosPorIdOperario = new Map();

export async function cargarOperariosCuadrilla() {
    const { ok, datos: filas } = await llamarUsuarios("operarioDeCuadrilla", "GET");
    if (!ok || !Array.isArray(filas)) return;

    _operariosPorCedula = new Map();
    _operariosPorIdOperario = new Map();

    filas.forEach((fila) => {
        _operariosPorCedula.set(String(fila.cedulaUsuario), fila);
        _operariosPorIdOperario.set(String(fila.idOperarioDeCuadrilla), fila);
    });
}

export async function idOperarioDesdeCedula(cedula) {
    if (!cedula) return null;
    if (_operariosPorCedula.size === 0) await cargarOperariosCuadrilla();
    const fila = _operariosPorCedula.get(String(cedula));
    return fila ? fila.idOperarioDeCuadrilla : null;
}

export function formatearFechaCorta(fechaMysql) {
    if (!fechaMysql) return "";
    const fecha = new Date(String(fechaMysql).replace(" ", "T"));
    if (isNaN(fecha.getTime())) return "";
    return fecha.toLocaleDateString("es-UY");
}

// Convierte a número (parseFloat, ignora texto sobrante como "1100 litros"), o null si está vacío.
export function aNumeroONull(valor) {
    if (valor === null || valor === undefined || valor === "") return null;
    const numero = parseFloat(valor);
    return isNaN(numero) ? null : numero;
}

export function aEnteroONull(valor) {
    if (valor === null || valor === undefined || valor === "") return null;
    const numero = parseInt(valor, 10);
    return isNaN(numero) ? null : numero;
}

export function fechaHoraParaMySQL(fecha) {
    const dosDigitos = (n) => String(n).padStart(2, "0");
    return `${fecha.getFullYear()}-${dosDigitos(fecha.getMonth() + 1)}-${dosDigitos(fecha.getDate())} ${dosDigitos(fecha.getHours())}:${dosDigitos(fecha.getMinutes())}:${dosDigitos(fecha.getSeconds())}`;
}

// Cuenta cuántos registros de "lista" caen en cada valor de "categorias", en
// ese mismo orden (nunca se reordena por cantidad) -- así en los gráficos de
// Resumen cada categoría mantiene siempre el mismo color/posición, tenga 0 o
// no registros. Usado por varios archivos de model/ (contenedores-
// incidencias.js, cuadrillas-camiones-rutas.js), por eso vive acá.
export function contarPorCategoria(lista, campo, categorias) {
    return categorias.map((categoria) => ({
        categoria,
        cantidad: lista.filter((item) => item[campo] === categoria).length
    }));
}

export function normalizarTexto(texto) {
    return texto.toString().toLowerCase();
}

// Accesores de solo lectura sobre `datos`. coleccion() centraliza el único
// caso especial (solicitudes lee solicitudesPendientes) para que el resto
// de model/ no tenga que conocerlo.
export function coleccion(modulo) {
    if (modulo === "solicitudes") return datos.solicitudesPendientes;
    return datos[modulo] || [];
}

export function obtenerRegistroPorId(modulo, id) {
    return coleccion(modulo).find((item) => item.id === id);
}
