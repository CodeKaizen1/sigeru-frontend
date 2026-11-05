// Punto 27 de la Fase 4: orquestador de carga. Estas 2 funciones son las
// únicas que necesitan conocer TODOS los demás archivos de model/ a la vez
// (para recargar/asegurar que cada módulo tenga lo que necesita cargado) --
// por eso quedaron aparte, en vez de "ensuciar" estado.js con imports de
// todos los dominios.
import { coleccion } from "./estado.js";
import { cargarContenedores, cargarIncidencias, recomputarResumenIncidenciasEnContenedores } from "./contenedores-incidencias.js";
import { cargarFuncionarios, cargarSolicitudes } from "./funcionarios.js";
// OJO (26/10/2026): este import SÍ lleva ?v= a diferencia de los demás de
// esta lista -- un cambio real a cuadrillas-camiones-rutas.js (el fix del
// bug de "marcar inicio/fin de ruta") no llegaba a navegadores que ya
// habían visitado el panel antes, porque Apache no manda Cache-Control acá
// y el navegador seguía sirviendo su copia en caché de la URL sin versión
// (confirmado a mano: misma URL, mismo Last-Modified viejo, contenido
// viejo). Si se vuelve a tocar este archivo, bumpear este ?v= (y el de
// model.js que lo reexporta, y los otros 4 imports internos sin versionar
// -- config-modulos.js, contenedores-incidencias.js, crud-generico.js,
// lectura-filtrado.js -- para que las 6 referencias apunten siempre a la
// MISMA url y no se terminen ejecutando 2 copias distintas del módulo a
// la vez).
import { cargarCuadrillas, cargarCamiones, cargarRutas } from "./cuadrillas-camiones-rutas.js?v=2";
import { cargarCentrosDeAcopio, cargarVertederos, cargarMaquinaria } from "./instalaciones.js";
import { cargarOperariosCuadrilla } from "./estado.js";

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

    if (modulo === "informes") {
        await cargarContenedores();
        await cargarIncidencias();
        recomputarResumenIncidenciasEnContenedores();
        return;
    }
}

// Recarga `modulo` (y sus joins) desde el servidor y devuelve la colección fresca.
export async function obtenerRegistros(modulo) {
    await asegurarCargado(modulo);
    return coleccion(modulo);
}
