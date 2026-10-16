// Punto 27 de la Fase 4: Centros de acopio / Vertederos / Maquinaria
// (api-gestion) -- mismo bloque que en el model.js original.
import { datos, llamarGestion, aNumeroONull } from "./estado.js";

function mapearInstalacion(fila) {
    return {
        id: String(fila.idInstalacion),
        nombre: fila.nombreInstalacion || "",
        ubicacion: fila.ubicacionInstalacion || "",
        capacidad: fila.capacidadInstalacion || "",
        estado: fila.estadoOperativoInstalacion || ""
    };
}

export async function cargarCentrosDeAcopio() {
    const { ok, datos: filas } = await llamarGestion("centroDeAcopio", "GET");
    if (!ok || !Array.isArray(filas)) return;
    datos.centrosDeAcopio = filas.map(mapearInstalacion);
}

export async function cargarVertederos() {
    const { ok, datos: filas } = await llamarGestion("vertedero", "GET");
    if (!ok || !Array.isArray(filas)) return;
    datos.vertederos = filas.map(mapearInstalacion);
}

export async function persistirInstalacion(modulo, registro) {
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

export async function cargarMaquinaria() {
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
