// Punto 27 de la Fase 4: Notificaciones (punto 16) --
// api-gestion?recurso=notificacion, no entra en el patrón de caché de
// "datos" porque necesita estar siempre al día (se vuelve a pedir cada vez
// que se abre la campanita), no una sola carga inicial. Es el único
// dominio de model/ que no toca `datos` para nada.
import { llamarGestion } from "./estado.js";

// Convierte la fila cruda del backend a lo que espera notificaciones-ui.js.
// fechaNotificacion viene "YYYY-MM-DD HH:MM:SS" (formato MySQL) -- se le
// cambia el espacio por "T" para que `new Date(...)` lo parsee siempre igual
// entre navegadores (mismo motivo que formatearFechaCorta() en estado.js).
function normalizarNotificacion(fila) {
    return {
        id: String(fila.idNotificacion),
        mensaje: fila.mensajeNotificacion || "",
        fecha: fila.fechaNotificacion ? String(fila.fechaNotificacion).replace(" ", "T") : new Date().toISOString(),
        leida: Boolean(Number(fila.leidaNotificacion)),
        entidadId: (fila.idEntidadNotificacion !== null && fila.idEntidadNotificacion !== undefined)
            ? String(fila.idEntidadNotificacion)
            : undefined,
        tipo: fila.tipoNotificacion || ""
    };
}

export async function obtenerNotificacionesAdmin() {
    const { ok, datos: filas } = await llamarGestion("notificacion", "GET", undefined, undefined, { destinatario: "admin" });
    if (!ok || !Array.isArray(filas)) return [];
    return filas.map(normalizarNotificacion);
}

export async function obtenerNotificacionesCuadrilla(idCuadrilla) {
    if (idCuadrilla === null || idCuadrilla === undefined || idCuadrilla === "") return [];

    const { ok, datos: filas } = await llamarGestion("notificacion", "GET", undefined, undefined, {
        destinatario: "cuadrilla",
        idCuadrilla
    });
    if (!ok || !Array.isArray(filas)) return [];
    return filas.map(normalizarNotificacion);
}

// Recibe la lista completa que pinta la campanita (no solo las no leídas --
// renderCampanita() avisa con todas al abrirse, ver notificaciones-ui.js) o un
// array de un solo elemento al hacer click en una puntual; ambos casos arman
// el mismo body {ids: [...]} para el PUT.
export async function marcarNotificacionesLeidas(notificaciones) {
    const ids = (notificaciones || [])
        .map((n) => Number(n.id))
        .filter((id) => Number.isInteger(id) && id > 0);

    if (!ids.length) return;

    await llamarGestion("notificacion", "PUT", { ids });
}
